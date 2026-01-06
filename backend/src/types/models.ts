export enum FlightStatus {
  SCHEDULED = 'SCHEDULED',
  DELAYED = 'DELAYED',
  DEPARTED = 'DEPARTED',
  ARRIVED = 'ARRIVED',
  CANCELLED = 'CANCELLED'
}

export enum NotificationType {
  DEPARTURE_REMINDER = 'DEPARTURE_REMINDER',
  TRAFFIC_ALERT = 'TRAFFIC_ALERT',
  DELAY_NOTIFICATION = 'DELAY_NOTIFICATION',
  CANCELLATION_ALERT = 'CANCELLATION_ALERT'
}

export enum UpdateType {
  DELAY = 'DELAY',
  GATE_CHANGE = 'GATE_CHANGE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  TIME_CHANGE = 'TIME_CHANGE'
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  homeAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Flight {
  id: string;
  userId: string;
  flightNumber: string;
  departureTime: Date;
  arrivalTime?: Date;
  origin: string;
  destination: string;
  status: FlightStatus;
  lastUpdated: Date;
  createdAt: Date;
}

export interface NotificationSchedule {
  id: string;
  userId: string;
  flightId: string;
  scheduledTime: Date;
  notificationType: NotificationType;
  isSent: boolean;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlightUpdate {
  id: string;
  flightId: string;
  updateType: UpdateType;
  oldValue?: string;
  newValue: string;
  source: string;
  timestamp: Date;
}

export interface TrafficUpdate {
  id: string;
  userId: string;
  origin: string;
  destination: string;
  travelTime: number; // in minutes
  delay: number; // in minutes
  timestamp: Date;
}
