import express from 'express';
import { NotificationRepo } from './repos/notificationRepo';
import { TrafficService } from './services/trafficService';
import { config } from './config';
import { rabbit } from './services/rabbit';
import { dashboard } from './services/dashboard';

export function createServer() {
  const app = express();
  app.use(express.json());

  const notifications = new NotificationRepo();
  const traffic = new TrafficService(notifications);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // No local users API — users are sourced from the main dashboard

  // Notifications dashboard
  app.get('/notifications', async (_req, res) => {
    res.json(await notifications.list());
  });

  // Manual trigger for testing
  app.post('/check-now', async (_req, res) => {
    try {
      const all = await dashboard.fetchUsers();
      const results = [] as any[];
      for (const u of all) {
        try {
          results.push(await traffic.checkUser(u));
        } catch (e: any) {
          results.push({ userId: u.id, error: e?.message || String(e) });
        }
      }
      res.json({ count: results.length, results });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  // Ensure Rabbit connection at startup
  rabbit.connect().catch(err => {
    console.error('RabbitMQ connection failed at startup:', err.message);
  });

  const server = app.listen(config.port, () => {
    console.log(`HTTP server listening on :${config.port}`);
  });

  return { app, server };
}
