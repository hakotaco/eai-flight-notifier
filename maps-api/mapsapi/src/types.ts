export type UUID = string;

// Represents a traveler record coming from the main dashboard (not stored locally)
export interface User {
  id: UUID;
  address: string; // traveler origin address
  flightNumber: string;
  // Optional metadata that may be provided by the dashboard but we don't persist
  email?: string;
  name?: string;
  // ISO 8601 date-time string of scheduled departure, if provided by the dashboard
  departureTime?: string;
}

export type TrafficStatus = 'regular' | 'heavy';

export interface TrafficAssessment {
  status: TrafficStatus;
  baseDurationSec: number; // expected without traffic
  trafficDurationSec: number; // expected with traffic now
  delaySec: number; // trafficDurationSec - baseDurationSec
  ratio: number; // trafficDurationSec / baseDurationSec
  routeSummary?: string;
}

export interface Notification {
  id: UUID;
  userId: UUID;
  flightNumber: string;
  createdAt: string; // ISO
  destination: string;
  origin: string;
  traffic: TrafficAssessment;
  // Optional: snapshot of flight arrival info from Schiphol service
  flightArrival?: {
    flightNumber: string;
    scheduleDate: string;
    scheduled?: string | null;
    estimated?: string | null;
    actual?: string | null;
    status?: string[];
    gate?: string | null;
    terminal?: string | null;
    lastUpdatedAt?: string | null;
  };
}
