import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { Flight } from "../entities/Flight";
import { UserFlightSubscription } from "../entities/UserFlightSubscription";
import dotenv from "dotenv";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || process.env.DB_PASS || "postgres",
  database: process.env.DB_NAME || "flight_notifier",
  synchronize: true,
  entities: [User, Flight, UserFlightSubscription],
  logging: false,
  subscribers: [],
  migrations: [],
});

export const initializeDatabase = async () => {
  try {
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
