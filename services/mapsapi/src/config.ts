import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  pollCron: process.env.POLL_CRON || '0 * * * *',
  pollWindowHours: parseInt(process.env.POLL_WINDOW_HOURS || '4', 10),
  mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  schipholAddress: process.env.SCHIPHOL_ADDRESS || 'Amsterdam Airport Schiphol',
  dashboardUsersUrl: process.env.DASHBOARD_USERS_URL || '',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  rabbitmqExchange: process.env.RABBITMQ_EXCHANGE || 'traffic.notifications',
};

export function requireEnv(key: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
