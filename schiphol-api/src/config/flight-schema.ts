import { z } from "zod";

// ISO 8601 Regex that supports Offsets (e.g., +01:00)
// Matches: 2025-12-16T01:12:11.883+01:00
const SCHIPHOL_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(([+-]\d{2}:\d{2})|Z)$/;

// Helper for consistent datetime validation
const zDateTime = () =>
  z
    .string()
    .regex(SCHIPHOL_DATETIME_REGEX, "Invalid ISO 8601 format with offset");

const VALID_SERVICE_TYPES = [
  "J",
  "C",
  "F",
  "P",
  "H",
  "G",
  "S",
  "O",
  "M",
  "W",
  "X",
] as const;

// Step A. Identity & Deduplication
const IdentitySchema = z.object({
  id: z.string(),
  mainFlight: z.string(),
  flightName: z.string(),
  flightDirection: z.enum(["A", "D"]),
  isOperationalFlight: z.boolean(),
  serviceType: z
    .preprocess((val) => {
      if (
        typeof val === "string" &&
        !VALID_SERVICE_TYPES.includes(val as any)
      ) {
        console.warn(`[DEBUG] Received unknown serviceType: "${val}".`);
      }
      return val;
    }, z.string())
    .optional(),
  scheduleDate: z.string(),
});

// Step B. Flight Status
const StatusSchema = z.object({
  publicFlightState: z.object({
    flightStates: z.array(z.string()), // e.g. ["ARR", "EXP", "TOM"]
  }),
});

// Step C. The Timeline
const TimelineSchema = z.object({
  scheduleDateTime: zDateTime(), // T0 (STD/STA)
  lastUpdatedAt: zDateTime(), // for deduplication

  // Arrival specific (Runway centric)
  estimatedLandingTime: zDateTime().nullable().optional(), // T1 (ELDT)
  actualLandingTime: zDateTime().nullable().optional(), // T2 (ALDT)

  // Departure specific (Gate centric)
  publicEstimatedOffBlockTime: zDateTime().nullable().optional(), // T1 (ETD)
  actualOffBlockTime: zDateTime().nullable().optional(), // T2 (ATD)
});

// Step D. Operational Context
const OperationalSchema = z.object({
  // 1. Location Resources
  gate: z.string().nullable().optional(),
  terminal: z.number().nullable().optional(), // Location (High Volatility)
  baggageClaim: z
    .object({
      belts: z.array(z.string()), // Array because big planes use multiple belts
    })
    .nullable()
    .optional(),

  // 2. Route & Governance
  route: z.object({
    destinations: z.array(z.string()), // Array for stopovers
    eu: z.string().nullable().optional(), // Schengen status, S for Schengen, N for Non-Schengen
    visa: z.boolean().optional(), // Visa requirement
  }),

  // 3. The Asset (Static)
  aircraftType: z
    .object({
      iataMain: z.string().optional().nullable(),
      iataSub: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),

  aircraftRegistration: z.string().nullable().optional(),
});

// Aggregated Flight Schema
export const FlightSchema = IdentitySchema.extend(TimelineSchema.shape)
  .extend(StatusSchema.shape)
  .extend(OperationalSchema.shape)
  .strip(); // Gatekeeper: Discard all unknown fields from Schiphol API

export const SchipholResponseSchema = z.object({
  flights: z.array(FlightSchema),
});

// Export types for downstream usage (Logic Layer)
export type FlightData = z.infer<typeof FlightSchema>;
export type SchipholResponse = z.infer<typeof SchipholResponseSchema>;
