import cron from 'node-cron';
import { NotificationRepo } from './repos/notificationRepo';
import { TrafficService } from './services/trafficService';
import { config } from './config';
import { dashboard } from './services/dashboard';

export function startScheduler() {
  const notifications = new NotificationRepo();
  const traffic = new TrafficService(notifications);

  async function runOnce(): Promise<void> {
    const all = await dashboard.fetchUsers();
    if (!all.length) {
      console.log('[Scheduler] No users to check');
      return;
    }
    // Filter by departure window: [now, now + pollWindowHours]
    const now = new Date();
    const horizon = new Date(now.getTime() + config.pollWindowHours * 60 * 60 * 1000);
    const inWindow = all.filter(u => {
      if (!u.departureTime) return false;
      const dt = new Date(u.departureTime);
      if (isNaN(dt.getTime())) return false;
      return dt >= now && dt <= horizon;
    });

    if (!inWindow.length) {
      console.log(
        `[Scheduler] No users departing within next ${config.pollWindowHours} hour(s); skipping run.`
      );
      return;
    }
    console.log(
      `[Scheduler] Checking traffic for ${inWindow.length} user(s) within ${config.pollWindowHours}h window (fetched ${all.length}).`
    );
    let ok = 0, failed = 0;
    for (const u of inWindow) {
      try {
        await traffic.checkUser(u);
        ok++;
      } catch (e: any) {
        failed++;
        console.error(`[Scheduler] Failed for user ${u.id}: ${e?.message || e}`);
      }
    }
    console.log(`[Scheduler] Done. Success: ${ok}, Failed: ${failed}`);
  }

  // Immediate run at startup
  runOnce().catch(e => console.error('[Scheduler] Initial run failed:', e?.message || e));

  // Cron schedule
  const task = cron.schedule(config.pollCron, () => {
    runOnce().catch(e => console.error('[Scheduler] Scheduled run failed:', e?.message || e));
  });
  console.log(`[Scheduler] Started with cron '${config.pollCron}'`);
  return task;
}
