import { initializeDatabase, AppDataSource } from "../infra/database";
import { FlightIngestionService } from "../services/FlightIngestionService";
import { SchipholService } from "../services/SchipholService";
import { FlightState } from "../core/entities/FlightState";
import { RabbitMQService } from "../infra/rabbitmq";

async function run() {
  try {
    // 1. Database Connection
    await initializeDatabase();

    // 2. Ingestion
    const schipholService = new SchipholService();
    const flightRepo = AppDataSource.getRepository(FlightState);
    const rabbitMQService = new RabbitMQService();
    const ingestion = new FlightIngestionService(
      schipholService,
      flightRepo,
      rabbitMQService
    );
    await ingestion.syncFlights();

    console.log("===============================");
    console.log("Verification: Checking DB records...");

    // 3. Verification
    const count = await AppDataSource.getRepository(FlightState).count();
    console.log(`Total records in FlightState table: ${count}`);
  } catch (err) {
    console.error("Ingestion test failed:", err);
  } finally {
    // 4. Close DB Connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

run();
