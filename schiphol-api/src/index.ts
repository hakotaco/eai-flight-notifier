import "reflect-metadata"; // TypeORM requirement
import cron from "node-cron";
import { AppDataSource } from "./infra/database";
import { SchipholService } from "./services/SchipholService";
import { FlightIngestionService } from "./services/FlightIngestionService";
import { FlightState } from "./core/entities/FlightState";
import { RabbitMQService } from "./infra/rabbitmq";

// Global State for Graceful Shutdown
let isShuttingDown = false;
let isJobRunning = false;

// Task Execution Handler for concurrency guards and runtime error containment.
const runIngestionTask = async (service: FlightIngestionService) => {
  // 1. Guard Clauses (Concurrency & Shutdown)
  if (isJobRunning) {
    console.warn("[Cron] Previous job still running. Skipping this tick.");
    return;
  }

  if (isShuttingDown) {
    console.warn("[Cron] System is shutting down. Skipping new job.");
    return;
  }

  // 2. Execution with Error Containment
  try {
    isJobRunning = true;
    await service.syncFlights();
  } catch (error) {
    console.error("[Cron] Job execution failed:", error);
  } finally {
    isJobRunning = false;
  }
};

// Application Bootstrap as Composition Root
async function bootstrap() {
  try {
    console.log("[System] Bootstrapping application...");

    // a. Initialize Infrastructure
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log("[System] Database connected.");
    }

    const mqService = new RabbitMQService();
    await mqService.connect(); // Must connect before usage
    console.log("[System] RabbitMQ connected.");

    /**
     *  Future in Production: The synchronize option should be disabled.
     *  if (!AppDataSource.isInitialized) {
     *    await AppDataSource.initialize();
     *    console.log("[System] Running pending migrations...");
     *    await AppDataSource.runMigrations();
     *    console.log("[System] Schema is up to date.");
     *  }
     */

    // b. Dependency Injection
    const schipholService = new SchipholService();
    const flightRepo = AppDataSource.getRepository(FlightState);

    const ingestionService = new FlightIngestionService(
      schipholService,
      flightRepo,
      mqService
    );

    console.log("[System] Dependencies wired successfully.");

    // c. Scheduling
    console.log("[System] Starting Cron Job (Schedule: Every 2 minutes)...");
    cron.schedule("*/2 * * * *", () => runIngestionTask(ingestionService));

    console.log(
      "[System] Application is running. Waiting for schedule trigger..."
    );

    // d. Catch Errors
  } catch (error) {
    console.error("[System] Fatal Error during bootstrap:", error);
    process.exit(1);
  }
}

// Graceful Shutdown Handler
const shutdown = async (signal: string) => {
  console.log(`[System] Received ${signal}. Starting graceful shutdown...`);
  isShuttingDown = true;

  // Wait for running job to finish, with a 30s timeout that aligns with Kubernetes default.
  const shutdownTimeout = 30000;
  const started = Date.now();

  // Wait for running job to finish
  while (isJobRunning) {
    if (Date.now() - started > shutdownTimeout) {
      console.error(
        "[System] Shutdown timed out waiting for job to finish. Forcing exit."
      );
      process.exit(1); // Force exit (Dirty shutdown)
    }

    console.log(
      "[System] Waiting for pending job to finish... (checking again in 1s)"
    );
    // Sleep for 1000ms
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log("[System] Database connection closed.");
    }
    console.log("[System] Shutdown complete. Goodbye.");
    process.exit(0);
  } catch (err) {
    console.error("[System] Error during shutdown:", err);
    process.exit(1);
  }
};

// Listen for termination signals (e.g., from Docker or Kubernetes)
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start the engine
bootstrap();
