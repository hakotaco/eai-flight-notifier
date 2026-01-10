import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn, // [1]
  UpdateDateColumn,
  Index,
} from "typeorm";

// Define a JSONB interface for Zod Schema
export interface RouteData {
  destinations: string[];
  eu?: string | null;
  visa?: boolean;
}

export interface BaggageData {
  belts: string[];
}

@Entity()
@Index(["mainFlight", "scheduleDate"])
export class FlightState {
  // Identity Schema
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ type: "varchar", length: 20 })
  mainFlight: string;

  @Column({ type: "varchar", length: 20 })
  flightName: string;

  @Column({ type: "varchar", length: 1 })
  flightDirection: "A" | "D";

  @Column({ type: "boolean", default: true })
  isOperationalFlight: boolean;

  @Column({ type: "varchar", length: 10 })
  scheduleDate: string; // YYYY-MM-DD

  // Timeline Schema

  @Column({ type: "timestamptz" })
  scheduleDateTime: Date; // STD / STA

  // Arrival -> estimatedLandingTime
  // Departure -> publicEstimatedOffBlockTime
  @Column({ type: "timestamptz", nullable: true })
  estimatedTime: Date | null;

  // Arrival -> actualLandingTime
  // Departure -> actualOffBlockTime
  @Column({ type: "timestamptz", nullable: true })
  actualTime: Date | null;

  @Column({ type: "timestamptz" })
  lastUpdatedAt: Date;

  // Status Schema
  @Column({ type: "simple-array", nullable: true })
  flightStates: string[];

  // Operational Schema
  @Column({ type: "varchar", length: 10, nullable: true })
  gate: string | null;

  @Column({ type: "int", nullable: true })
  terminal: number | null;

  @Column({ type: "jsonb", nullable: true })
  route: RouteData | null;

  @Column({ type: "jsonb", nullable: true })
  baggageClaim: BaggageData | null;

  // Metadata
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "timestamptz" })
  lastCheckedAt: Date;
}

/**
 * [1] // https://stackoverflow.com/questions/64941148/node-js-add-created-at-and-updated-at-in-entity-of-typeorm
 * */
