import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export enum FlightStatus {
  SCHEDULED = "SCHEDULED",
  DELAYED = "DELAYED",
  DEPARTED = "DEPARTED",
  ARRIVED = "ARRIVED",
  CANCELLED = "CANCELLED",
}

@Entity()
@Index(["flightNumber", "scheduleDate"])
@Index(["flightNumber"])
@Index(["scheduledDepartureTime"])
export class Flight {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ type: "varchar", length: 20 })
  flightNumber: string;

  @Column({ type: "varchar", length: 10 })
  scheduleDate: string; // YYYY-MM-DD format

  @Column({ type: "timestamptz" })
  scheduledDepartureTime: Date; // Original scheduled time (never changes)

  @Column({ type: "timestamptz", nullable: true })
  actualDepartureTime: Date | null; // Updated by Schiphol service

  @Column({ type: "timestamptz", nullable: true })
  arrivalTime: Date | null;

  @Column({ type: "varchar", length: 100 })
  origin: string;

  @Column({ type: "varchar", length: 100 })
  destination: string;

  @Column({ type: "varchar", length: 20 })
  status: FlightStatus;

  @Column({ type: "timestamptz" })
  lastUpdated: Date;

  @CreateDateColumn()
  createdAt: Date;
}
