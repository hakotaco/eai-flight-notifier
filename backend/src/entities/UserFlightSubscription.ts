import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity()
@Index(["userId", "flightId"], { unique: true })
@Index(["flightId"])
export class UserFlightSubscription {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ type: "varchar", length: 50 })
  userId: string;

  @Column({ type: "varchar", length: 50 })
  flightId: string;

  @Column({ type: "timestamptz" })
  subscribedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
