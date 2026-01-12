import { In, Repository } from "typeorm";
import { FlightState } from "../core/entities/FlightState";
import { SchipholService } from "./SchipholService";
import type { FlightData } from "../config/flight-schema";
import type { RabbitMQService } from "../infra/rabbitmq";
import {
  calculateDelayMinutes,
  hasDelayChanged,
} from "../core/logic/DelayCalculator";

// This interface can be refactored to env.d.ts if needed.
interface FlightDelayEventPayload {
  flightId: string;
  flightNumber: string;
  scheduleDate: string;
  scheduledDepartureTime: string;
  actualDepartureTime: string | null;
  arrivalTime: string | null;
  origin: string;
  destination: string;
  status: string;
  updateType: "DELAY" | "TIME_CHANGE";
  oldDelayMinutes: number;
  newDelayMinutes: number;
  timestamp: string;
}

/**
 * Pure Function: Transforms external API data into internal Database Entity s.t.
 * The mapping logic is isolated from the persistence logic.
 */

const mapToEntity = (data: FlightData): FlightState => {
  const entity = new FlightState();

  // Logic: Try Arrival time first, fallback to Departure time.
  // Context: Schiphol API guarantees one set exists based on flightDirection.
  const rawEstimated =
    data.estimatedLandingTime || data.publicEstimatedOffBlockTime;
  const rawActual = data.actualLandingTime || data.actualOffBlockTime;

  // Identity
  entity.id = data.id;
  entity.mainFlight = data.mainFlight;
  entity.flightName = data.flightName;
  entity.flightDirection = data.flightDirection;
  entity.isOperationalFlight = data.isOperationalFlight;

  // Timeline (String -> Date conversion for timestamptz)
  entity.scheduleDate = data.scheduleDate;
  entity.scheduleDateTime = new Date(data.scheduleDateTime);
  entity.lastUpdatedAt = new Date(data.lastUpdatedAt);

  // Nullable Time Fields
  entity.estimatedTime = rawEstimated ? new Date(rawEstimated) : null;
  entity.actualTime = rawActual ? new Date(rawActual) : null;

  // Evaluation only
  entity.lastCheckedAt = new Date();

  // Status & Operations
  entity.flightStates = data.publicFlightState?.flightStates || [];

  entity.gate = data.gate || null;
  entity.terminal = data.terminal || null;

  // Complex Objects -> JSONB
  entity.route = data.route || null;
  entity.baggageClaim = data.baggageClaim || null;

  return entity;
};

export class FlightIngestionService {
  private schipholService: SchipholService;
  private flightRepo: Repository<FlightState>;
  private mq: RabbitMQService;

  /**
   * Constructor Injection (DI).
   * Dependencies are passed in, making this class purely about logic, not configuration.
   * @param schipholService - Source of flight data
   * @param flightRepo - Destination for persistence
   * @param mq - Message Bus Adapter for domain events
   */

  constructor(
    schipholService: SchipholService,
    flightRepo: Repository<FlightState>,
    mq: RabbitMQService
  ) {
    this.schipholService = schipholService;
    this.flightRepo = flightRepo;
    this.mq = mq;
  }

  /**
   * The Main Synchronization Loop.
   */
  public async syncFlights(): Promise<void> {
    console.log("[FlightIngestionService] Starting sync job...");

    try {
      // 1. Extract
      const rawFlights = await this.schipholService.fetchFlights();

      if (rawFlights.length === 0) {
        console.log(
          "[FlightIngestionService] No flights found. Skipping sync."
        );
        return;
      }

      // 2. Transform & Deduplicate
      const allEntities = rawFlights.map(mapToEntity);

      // Perform In-Memory Deduplication
      const uniqueMap = new Map<string, FlightState>();
      for (const entity of allEntities) {
        uniqueMap.set(entity.id, entity);
      }
      const uniqueEntities = Array.from(uniqueMap.values());

      console.log(
        `[FlightIngestionService] Processed ${allEntities.length} raw records into ${uniqueEntities.length} unique entities.`
      );

      // 3. Detect Changes
      await this.processDelayEvents(uniqueEntities);

      // 4. Load (Upsert Strategy)
      console.log(
        `[FlightIngestionService] Upserting ${uniqueEntities.length} flight records...`
      );

      await this.flightRepo.upsert(uniqueEntities, {
        conflictPaths: ["id"], // The column to check for uniqueness
        skipUpdateIfNoValuesChanged: false, // Always update fields to match API source
      });

      console.log("[FlightIngestionService] Sync job completed successfully.");
    } catch (error) {
      console.error("[FlightIngestionService] Sync job failed:", error);
      throw error;
    }
  }

  /**
   * Encapsulates the logic for detecting changes and publishing events.
   * This keeps the main sync loop clean and focused on orchestration.
   */
  private async processDelayEvents(newFlights: FlightState[]): Promise<void> {
    // 1. Batch Fetch Existing Records
    // 1.a
    const flightIds = newFlights.map((f) => f.id);

    // 1.b
    const existingRecords = await this.flightRepo.findBy({
      id: In(flightIds),
    });

    // 1.c
    const existingMap = new Map<string, FlightState>(
      existingRecords.map((f) => [f.id, f])
    );

    // 2. Diffing Loop
    let eventsPublished = 0;

    for (const newFlight of newFlights) {
      // 2.a
      const oldFlight = existingMap.get(newFlight.id);

      // 2.b
      const newDelayMinutes = calculateDelayMinutes(
        newFlight.scheduleDateTime,
        newFlight.actualTime
      );

      // 2.c
      const oldDelayMinutes = oldFlight
        ? calculateDelayMinutes(
            oldFlight.scheduleDateTime,
            oldFlight.actualTime
          )
        : 0;

      // 3. Detect Significant Changes
      if (hasDelayChanged(oldDelayMinutes, newDelayMinutes)) {
        const eventPayload = this.createDelayEventPayload(
          newFlight,
          oldDelayMinutes,
          newDelayMinutes
        );
        const queueName = process.env.FLIGHT_UPDATES_QUEUE || "flight.delayed";
        await this.mq.publish(queueName, eventPayload);
        eventsPublished++;
      }
    }

    if (eventsPublished > 0) {
      console.log(
        `[FlightIngestionService] Published ${eventsPublished} delay change events.`
      );
    }

    // Always publish a ghost demo event for EX1234
    await this.publishDemoFlightEvent();
  }

  /**
   * Publishes a ghost demo event for flight EX1234.
   * This is for demonstration purposes and doesn't correspond to a real flight.
   */
  private async publishDemoFlightEvent(): Promise<void> {
    try {
      const now = new Date();
      const scheduledTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
      const delayedTime = new Date(scheduledTime.getTime() + 45 * 60 * 1000); // 45 min delay

      const demoEvent: FlightDelayEventPayload = {
        flightId: "demo-ex1234-" + now.getTime(),
        flightNumber: "EX1234",
        scheduleDate: scheduledTime.toISOString().split('T')[0]!,
        scheduledDepartureTime: scheduledTime.toISOString(),
        actualDepartureTime: delayedTime.toISOString(),
        arrivalTime: new Date(delayedTime.getTime() + 90 * 60 * 1000).toISOString(),
        origin: "Schiphol Airport (AMS)",
        destination: "Demo Destination (DEMO)",
        status: "DELAYED",
        updateType: "DELAY",
        oldDelayMinutes: 0,
        newDelayMinutes: 45,
        timestamp: now.toISOString(),
      };

      const queueName = process.env.FLIGHT_UPDATES_QUEUE || "flight.delayed";
      await this.mq.publish(queueName, demoEvent);
      console.log("[FlightIngestionService] Published ghost demo event for EX1234");
    } catch (error) {
      console.error("[FlightIngestionService] Failed to publish demo event:", error);
      // Don't throw - this is a bonus feature
    }
  }

  /**
   * Helper to construct the event payload object.
   */

  private SIGNIFICANT_DELAY_THRESHOLD_MINUTES = 15;

  private createDelayEventPayload(
    flight: FlightState,
    oldDelayMinutes: number,
    newDelayMinutes: number
  ): FlightDelayEventPayload {
    const destinations = flight.route?.destinations?.join(', ') || 'Unknown';
    const isArrival = flight.flightDirection === 'A';
    
    return {
      flightId: flight.id,
      flightNumber: flight.mainFlight,
      scheduleDate: flight.scheduleDate,
      scheduledDepartureTime: flight.scheduleDateTime.toISOString(),
      actualDepartureTime: flight.actualTime ? flight.actualTime.toISOString() : null,
      arrivalTime: flight.estimatedTime ? flight.estimatedTime.toISOString() : null,
      origin: isArrival ? destinations : 'Schiphol Airport (AMS)',
      destination: isArrival ? 'Schiphol Airport (AMS)' : destinations,
      status: this.mapFlightStatus(flight.flightStates, newDelayMinutes),
      updateType: newDelayMinutes > this.SIGNIFICANT_DELAY_THRESHOLD_MINUTES ? "DELAY" : "TIME_CHANGE",
      oldDelayMinutes,
      newDelayMinutes,
      timestamp: new Date().toISOString(),
    };
  }

  private mapFlightStatus(flightStates: string[], delayMinutes: number): string {
    if (!flightStates || flightStates.length === 0) {
      return delayMinutes > this.SIGNIFICANT_DELAY_THRESHOLD_MINUTES ? 'DELAYED' : 'SCHEDULED';
    }
    
    const statesStr = flightStates.join(',').toUpperCase();
    
    if (statesStr.includes('CANCEL')) return 'CANCELLED';
    if (statesStr.includes('DEPARTED') || statesStr.includes('AIR')) return 'DEPARTED';
    if (statesStr.includes('ARRIVED') || statesStr.includes('LANDED')) return 'ARRIVED';
    if (delayMinutes > this.SIGNIFICANT_DELAY_THRESHOLD_MINUTES) return 'DELAYED';
    
    return 'SCHEDULED';
  }
}
