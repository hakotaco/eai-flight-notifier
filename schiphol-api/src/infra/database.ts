import "reflect-metadata";
import { DataSource } from "typeorm";
import { FlightState } from "../core/entities/FlightState";
import dotenv from "dotenv";

dotenv.config();

export const AppDataSource = new DataSource({
  // [1], [2]
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  synchronize: true,
  entities: [FlightState],
  logging: false,
  subscribers: [],
  migrations: [],
});

export const initializeDatabase = async () => {
  try {
    // [3]
    if (!AppDataSource.isInitialized) {
      console.log("Initializing TypeORM DataSource...");
      await AppDataSource.initialize();
      console.log("Database connection via TypeORM has established.");
    }
  } catch (error) {
    console.error("TypeORM initialization failed:", error);
    throw error;
  }
};

/**
 * [1] https://typeorm.io/docs/data-source/data-source
 * [2] https://typeorm.io/docs/data-source/data-source-options
 * [3] https://typeorm.io/docs/data-source/data-source-api
 */
