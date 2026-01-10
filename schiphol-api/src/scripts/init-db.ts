import { AppDataSource, initializeDatabase } from "../infra/database";
import { FlightState } from "../core/entities/FlightState";

async function runInit() {
  try {
    await initializeDatabase();
    console.log(" TypeORM is ready.");
    // Verify if repo is fetchable.
    const repo = AppDataSource.getRepository(FlightState);
    console.log(`[Init] Entity mapped to table: '${repo.metadata.tableName}'`);
  } catch (err) {
    console.error("Initialization failed", err);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

runInit();
