import { config } from './config';
import { rabbit } from './services/rabbit';
import { TrafficService } from './services/trafficService';
import { User } from './types';

async function main() {
  if (!config.mapsApiKey) {
    console.warn('WARNING: GOOGLE_MAPS_API_KEY is not set. The service will fail when calling Maps API.');
  }

  // MQ-only mode: connect to Rabbit and start consuming traveler messages from the dashboard
  await rabbit.connect();
  const traffic = new TrafficService();

  const inWindow = (u: User): boolean => {
    if (!u.departureTime) return false;
    const now = new Date();
    const dt = new Date(u.departureTime);
    if (isNaN(dt.getTime())) return false;
    const horizon = new Date(now.getTime() + config.pollWindowHours * 60 * 60 * 1000);
    return dt >= now && dt <= horizon;
  };

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

  const shutdown = (signal: string) => async () => {
    console.log(`Received ${signal}, shutting down...`);
    process.exit(0);
  };
  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

main().catch(err => {
  console.error('Fatal error starting service:', err);
  process.exit(1);
});
