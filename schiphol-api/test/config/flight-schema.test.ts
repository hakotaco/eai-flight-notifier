import { describe, expect, it } from "bun:test";
import {
  FlightSchema,
  SchipholResponseSchema,
} from "../../src/config/flight-schema";
import rawData from "../fixtures/flight_data.json";

// Helper function for testing
const getValidFlight = () => ({
  id: "test-boundary-1",
  mainFlight: "TEST001",
  flightName: "TEST001",
  flightDirection: "A",
  isOperationalFlight: true,
  scheduleDate: "2025-12-16",
  scheduleDateTime: "2025-12-16T10:00:00+01:00",
  lastUpdatedAt: "2025-12-16T09:00:00+01:00",
  publicFlightState: { flightStates: ["ARR", "EXP", "TOM"] },
  route: {
    destinations: ["AMS"],
    eu: "S",
    visa: false,
  },
  // Optional fields left undefined to test minimal requirement
});

describe("Schiphol API Schema Validation", () => {
  // Test case 1. Happy Path
  it("should parse the probed raw data successfully", () => {
    const result = SchipholResponseSchema.safeParse(rawData);

    if (!result.success) {
      console.error(
        "Zod parsing error: ",
        JSON.stringify(result.error!.issues, null, 2)
      );
    }
    expect(result.success).toBe(true);

    if (result.success) {
      const flight = result.data.flights[0];
      if (!flight) {
        throw new Error("No flight found in fixtures");
      }
      // Identity
      expect(flight.id).toBeDefined();
      expect(flight.mainFlight).toBeDefined();
      // Timeline
      expect(flight.scheduleDateTime).toBeDefined();
      // Status
      expect(flight.publicFlightState.flightStates).toBeInstanceOf(Array);

      // Assert: Evaluate if Strip Unknown is effective
      // @ts-ignore
      expect(flight.checkinAllocations).toBeUndefined();
    }
  });

  // Test case 2. Validation Logic
  it("should fail when critical identity fields are missing", () => {
    const invalidData = {
      flights: [
        {
          flightName: "KL808",
          flightDirection: "2025-12-16T00:05:00.000+01:00",
          isOperationalFlight: true,
          publicFlightState: {
            flightStates: ["ARR", "EXP", "TOM"],
          },
        },
      ],
    };
    const result = SchipholResponseSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  // Test case 3. Nullable Handling
  it("should handle nullable fields correctly. e.g. Gate/Terminal", () => {
    const invalidData = {
      flights: [
        {
          id: "test-123",
          mainFlight: "TEST01",
          flightName: "TEST01",
          flightDirection: "A",
          isOperationalFlight: true,
          scheduleDate: "2025-12-16",
          scheduleDateTime: "2025-12-16T10:00:00.000+01:00",
          lastUpdatedAt: "2025-12-16T09:00:00.000+01:00",
          publicFlightState: { flightStates: ["SCH"] },
          route: {
            destinations: ["AMS"],
            eu: "S",
            visa: false,
          },
          // Null operational fields
          gate: null,
          terminal: null,
        },
      ],
    };
    const result = SchipholResponseSchema.safeParse(invalidData);
    expect(result.success).toBe(true);
  });
});

describe("Schiphol API Schema Validation - Edge Cases", () => {
  // Test case 4. Date Format Integrity
  it("should fail on invalid ISO date formats or missing offsets", () => {
    const invalidDateCases = [
      "2025/12/16", // Wrong separator
      "2025-12-16 10:00:00", // Missing 'T'
      "2025-12-16T10:00:00", // Missing Offset (Zod defaults to ISO but our regex requires Offset)
      "invalid-date-string", // Completely invalid
    ];

    invalidDateCases.forEach((dateStr) => {
      const data = {
        flights: [{ ...getValidFlight(), scheduleDateTime: dateStr }],
      };
      const result = SchipholResponseSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // Test case 5. Enum Constraints
  it("should allow non-standard values for EU status (Resilience)", () => {
    const weirdEu = {
      ...getValidFlight(),
      route: { ...getValidFlight().route, eu: "Unknown" },
    };
    const result = FlightSchema.safeParse(weirdEu);
    // This should now BE true because we relaxed the schema
    expect(result.success).toBe(true);
  });

  it("should enforce strict enum for FlightDirection", () => {
    const invalid = { ...getValidFlight(), flightDirection: "X" };
    const result = FlightSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  // Test case 6. Strict Type Checking
  it("should fail if numeric fields receive strings (No coercion allowed)", () => {
    const data = {
      flights: [
        {
          ...getValidFlight(),
          terminal: "1", // If terminal is a number, this should fail
        },
      ],
    };

    const result = SchipholResponseSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
