import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  pollCron: process.env.POLL_CRON || '0 * * * *',
  pollWindowHours: parseInt(process.env.POLL_WINDOW_HOURS || '4', 10),
  mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  schipholAddress: process.env.SCHIPHOL_ADDRESS || 'Amsterdam Airport Schiphol',
  // Deprecated in MQ-only mode; retained for backward compatibility
  dashboardUsersUrl: process.env.DASHBOARD_USERS_URL || '',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  rabbitmqExchange: process.env.RABBITMQ_EXCHANGE || 'traffic.notifications',
  // MQ-only integration
  dashboardTravelersQueue: process.env.DASHBOARD_TRAVELERS_QUEUE || 'dashboard.travelers',
  schipholArrivalRequestQueue: process.env.SCHIPHOL_ARRIVAL_REQUEST_QUEUE || 'schiphol.arrival.request',
  rpcTimeoutMs: parseInt(process.env.RPC_TIMEOUT_MS || '8000', 10),
  schipholApiUrl: process.env.SCHIPHOL_API_URL || '',
};

export function requireEnv(key: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
