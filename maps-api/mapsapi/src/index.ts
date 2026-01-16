import { config } from './config';
import { createServer } from './server';
import { rabbit } from './services/rabbit';
import { TrafficService } from './services/trafficService';
import { User } from './types';
import { startScheduler } from './scheduler';

async function main() {
  if (!config.mapsApiKey) {
    console.warn('WARNING: GOOGLE_MAPS_API_KEY is not set. The service will fail when calling Maps API.');
  }

  // Start HTTP server
  const { server } = createServer();
  console.log(`Maps API service starting on port ${config.port}`);

  // MQ-only mode: connect to Rabbit and start consuming traveler messages from the dashboard
  await rabbit.connect();
  const traffic = new TrafficService();

  const inWindow = (u: User): boolean => {
    if (!u.departureTime) return false;
    const now = new Date();
    const cet = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })).getTime();
    const dt = new Date(u.departureTime).getTime();
    const horizon = dt - config.pollWindowHours * 60 * 60 * 1000;
    return (cet >= horizon && cet <= dt);
  };

  // Event-driven: Handle immediate signup notifications
  await rabbit.consumeTravelers(async (u: User) => {
    try {
      if (!inWindow(u)) {
        console.log(`[Consumer] Skipping user ${u.id}: not within ${config.pollWindowHours}h window.`);
        return;
      }
      const notification = await traffic.checkUser(u);
      console.log(`[Consumer] Published traffic notification for user ${u.id} / flight ${u.flightNumber}.`);
    } catch (err: any) {
      console.error(`[Consumer] Error processing user ${u.id}:`, err?.message || err);
      throw err; // let consumer nack
    }
  });

  // Periodic: Check all users on a schedule to catch those entering the window
  if (config.dashboardUsersUrl) {
    startScheduler();
    console.log('[Main] Scheduler enabled - will periodically check all users');
  } else {
    console.warn('[Main] DASHBOARD_USERS_URL not set - scheduler disabled');
  }

  const shutdown = (signal: string) => async () => {
    console.log(`Received ${signal}, shutting down...`);
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

main().catch(err => {
  console.error('Fatal error starting service:', err);
  process.exit(1);
});
