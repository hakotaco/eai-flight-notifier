import { describe, it, expect, mock, beforeEach, type Mock } from "bun:test";
import { FlightIngestionService } from "../../src/services/FlightIngestionService";
import type { SchipholService } from "../../src/services/SchipholService";
import type { Repository } from "typeorm";
import type { FlightState } from "../../src/core/entities/FlightState";
import type { RabbitMQService } from "../../src/infra/rabbitmq";

// Mock Dependencies

// A. Mock Database (Destination)
const mockRepoSave = mock();
const mockRepo = {
  save: mockRepoSave,
};

mock.module("../../src/infra/database", () => ({
  AppDataSource: {
    getRepository: () => mockRepo,
  },
}));

// B. Mock SchipholService (Source)
const mockFetchFlights = mock();

// C. Mock SchipholService class constructor and method
mock.module("../../src/services/SchipholService", () => ({
  SchipholService: class {
    fetchFlights = mockFetchFlights;
  },
}));

// 1. Test Data Helper (Centralized)
const getRawFlightData = () => [
  {
    id: "135832729904259587",
    mainFlight: "HV 6731",
    flightName: "HV6731",
    flightDirection: "A" as const,
    scheduleDate: "2025-12-25",
    scheduleDateTime: "2025-12-25T10:00:00.000+01:00", // UTC 09:00
    lastUpdatedAt: "2024-12-05T04:49:03.454+01:00",

    // Time fields
    estimatedLandingTime: "2025-12-25T10:00:00.000+01:00",
    actualLandingTime: null as string | null,

    isOperationalFlight: true,
    publicFlightState: { flightStates: ["ARR"] },
    route: {
      destinations: ["JFK"],
      eu: "N",
      visa: true,
    },
  },
];

const rawData = getRawFlightData();

describe("FlightIngestionService", () => {
  let service: FlightIngestionService;
  let mockSchipholService: SchipholService;
  let mockRepo: Repository<FlightState>;
  let mockMQ: RabbitMQService;

  // Mock Functions
  let mockFetchFlights: Mock<() => Promise<any[]>>;
  let mockRepoUpsert: Mock<(entities: any[], options?: any) => Promise<any>>;
  let mockRepoFindBy: Mock<(criteria: any) => Promise<any[]>>;
  let mockMQPublish: Mock<(key: string, msg: any) => Promise<boolean>>;

  beforeEach(() => {
    // 2. Setup Mocks
    mockFetchFlights = mock(() => Promise.resolve([]));
    mockRepoUpsert = mock(() => Promise.resolve({})); // upsert returns InsertResult
    mockRepoFindBy = mock(() => Promise.resolve([]));
    mockMQPublish = mock(() => Promise.resolve(true));

    mockSchipholService = {
      fetchFlights: mockFetchFlights,
    } as unknown as SchipholService;

    // TypeORM Repository Mock
    mockRepo = {
      upsert: mockRepoUpsert, // Key change: using upsert
      findBy: mockRepoFindBy,
    } as unknown as Repository<FlightState>;

    mockMQ = {
      publish: mockMQPublish,
      connect: mock(() => Promise.resolve()),
    } as unknown as RabbitMQService;

    // 3. Instantiate
    service = new FlightIngestionService(mockSchipholService, mockRepo, mockMQ);
  });

  // Group A: Core ETL Logic (Happy Path)
  // Combine the Transformation & Flow Control tests
  it("should execute full ETL cycle: Fetch -> Map -> Diff -> Save", async () => {
    // Arrange
    mockFetchFlights.mockResolvedValue(rawData);
    mockRepoFindBy.mockResolvedValue([]); // No existing records

    // Act
    await service.syncFlights();

    // Assert 1: Flow Control
    expect(mockFetchFlights).toHaveBeenCalledTimes(1);
    expect(mockRepoFindBy).toHaveBeenCalledTimes(1);

    // Assert 2: Data Transformation Integrity
    expect(mockRepoUpsert).toHaveBeenCalledTimes(1);
    const [upsertedEntities, upsertOptions] = mockRepoUpsert.mock.calls[0]!;

    expect(upsertedEntities).toHaveLength(1);
    expect(upsertedEntities[0].mainFlight).toBe("HV 6731");

    // Verify Conflict Paths for Safety
    expect(upsertOptions).toEqual({
      conflictPaths: ["id"],
      skipUpdateIfNoValuesChanged: false,
    });

    // A2.1: ID & Identity
    expect(upsertedEntities[0].id).toBe("135832729904259587");

    // A2.2: Date Conversion (UTC check)
    // 10:00+01:00 -> 09:00 UTC
    expect(upsertedEntities[0].scheduleDateTime).toBeInstanceOf(Date);
    expect(upsertedEntities[0].scheduleDateTime.toISOString()).toBe(
      "2025-12-25T09:00:00.000Z"
    );

    // A2.3: Nullable handling
    expect(upsertedEntities[0].estimatedTime).toBeInstanceOf(Date);
    expect(upsertedEntities[0].actualTime).toBeNull(); // API gave null, should be null

    // A2.4: JSONB preservation
    expect(upsertedEntities[0].route).toEqual({
      destinations: ["JFK"],
      eu: "N",
      visa: true,
    });
  });

  // Group B: Deduplication Logic
  it("should deduplicate records by ID before upserting", async () => {
    const record = getRawFlightData()[0];
    // Arrange: API returns the SAME record twice (Input Duplication)
    const duplicateData = [record, record];

    mockFetchFlights.mockResolvedValue(duplicateData);
    mockRepoFindBy.mockResolvedValue([]);

    // Act
    await service.syncFlights();

    // Assert
    const [upsertedEntities] = mockRepoUpsert.mock.calls[0]!;

    // Should be reduced to 1 unique entity
    expect(upsertedEntities).toHaveLength(1);
    expect(upsertedEntities[0].id).toBe(record?.id);
  });

  // Group C: Domain Events (Logic Integration)

  // Case 1: Cold Start (New Flight) with Delay
  // Policy: We removed the guard, so this SHOULD publish an event.
  it("should publish event for NEW flight if it is delayed (Cold Start Notification)", async () => {
    // 45 mins delay
    const rawData = getRawFlightData();
    rawData[0]!.actualLandingTime = "2025-12-25T10:45:00.000+01:00";

    mockFetchFlights.mockResolvedValue(rawData);
    mockRepoFindBy.mockResolvedValue([]); // No history (Cold Start)

    // Act
    await service.syncFlights();

    // Assert
    expect(mockMQPublish).toHaveBeenCalledTimes(1);
    const payload = mockMQPublish?.mock?.calls?.[0]?.[1];
    expect(payload.newDelayMinutes).toBe(45);
    expect(payload.status).toBe("DELAYED");
  });

  // Case 2: Existing Flight with Changed Delay
  it("should publish event when delay increases", async () => {
    // New: 60 mins delay
    const rawData = getRawFlightData();
    rawData[0]!.actualLandingTime = "2025-12-25T11:00:00.000+01:00";

    mockFetchFlights.mockResolvedValue(rawData);

    // Existing: 30 mins delay
    mockRepoFindBy.mockResolvedValue([
      {
        id: rawData[0]!.id,
        scheduleDateTime: new Date(rawData[0]!.scheduleDateTime),
        actualTime: new Date("2025-12-25T10:30:00.000+01:00"), // 30m delay
      },
    ] as any);

    // Act
    await service.syncFlights();

    // Assert
    expect(mockMQPublish).toHaveBeenCalledTimes(1);
    const payload = mockMQPublish.mock.calls[0]![1];
    expect(payload.oldDelayMinutes).toBe(30);
    expect(payload.newDelayMinutes).toBe(60);
  });

  // Case 3: No Change
  it("should NOT publish event if delay is unchanged", async () => {
    // 20 min delay
    const rawData = getRawFlightData();
    rawData[0]!.actualLandingTime = "2025-12-25T10:20:00.000+01:00";

    mockFetchFlights.mockResolvedValue(rawData);

    // Existing: SAME 20 min delay
    mockRepoFindBy.mockResolvedValue([
      {
        id: rawData[0]!.id,
        scheduleDateTime: new Date(rawData[0]!.scheduleDateTime),
        actualTime: new Date(rawData[0]!.actualLandingTime),
      },
    ] as any);

    // Act
    await service.syncFlights();

    expect(mockMQPublish).not.toHaveBeenCalled();
  });

  // --- Group D: Error Propagation ---
  it("should propagate errors from SchipholService", async () => {
    mockFetchFlights.mockRejectedValue(new Error("API Down"));
    expect(service.syncFlights()).rejects.toThrow("API Down");
  });
});
