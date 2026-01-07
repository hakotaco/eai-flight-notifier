import { config } from './config';
import { createServer } from './server';
import { startScheduler } from './scheduler';

async function main() {
  if (!config.mapsApiKey) {
    console.warn('WARNING: GOOGLE_MAPS_API_KEY is not set. The service will fail when calling Maps API.');
  }
  if (!config.dashboardUsersUrl) {
    console.warn('WARNING: DASHBOARD_USERS_URL is not set. Scheduler will have no users to check.');
  }
  const { server } = createServer();
  startScheduler();

  const shutdown = (signal: string) => async () => {
    console.log(`Received ${signal}, shutting down...`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

main().catch(err => {
  console.error('Fatal error starting service:', err);
  process.exit(1);
});
