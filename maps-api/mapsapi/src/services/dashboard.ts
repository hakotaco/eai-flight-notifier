import axios from 'axios';
import { config } from '../config';
import { User } from '../types';

export class DashboardClient {
  async fetchUsers(): Promise<User[]> {
    if (!config.dashboardUsersUrl) {
      console.warn('DASHBOARD_USERS_URL not set; returning empty user list');
      return [];
    }
    const { data } = await axios.get(config.dashboardUsersUrl);
    if (!Array.isArray(data)) {
      throw new Error('Dashboard users endpoint did not return an array');
    }
    // Normalize and validate fields
    const users: User[] = [];
    for (const u of data) {
      if (!u) continue;
      const id = String(u.id ?? u.userId ?? '');
      const address = String(u.address ?? '');
      const flightNumber = String(u.flightNumber ?? '');
      if (!id || !address || !flightNumber) continue;
      const rawDt = u.departureTime ?? u.departureDateTime ?? u.departureAt ?? u.scheduledDeparture ?? u.departAt;
      let departureTime: string | undefined;
      if (rawDt != null) {
        try {
          // Accept ISO string or timestamp (ms/sec)
          let d: Date;
          if (typeof rawDt === 'number') {
            // If it's a small number, assume seconds; otherwise milliseconds
            const ms = rawDt < 10_000_000_000 ? rawDt * 1000 : rawDt;
            d = new Date(ms);
          } else if (typeof rawDt === 'string') {
            const num = Number(rawDt);
            if (!Number.isNaN(num) && rawDt.trim() !== '') {
              const ms = num < 10_000_000_000 ? num * 1000 : num;
              d = new Date(ms);
            } else {
              d = new Date(rawDt);
            }
          } else {
            d = new Date(String(rawDt));
          }
          if (!isNaN(d.getTime())) {
            departureTime = d.toISOString();
          }
        } catch {}
      }
      users.push({ id, address, flightNumber, email: u.email, name: u.name, departureTime });
    }
    return users;
  }
}

export const dashboard = new DashboardClient();
