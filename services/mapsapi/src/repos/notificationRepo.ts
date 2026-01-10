import { v4 as uuidv4 } from 'uuid';
import { JsonStore } from '../utils/jsonStore';
import { Notification } from '../types';

type NotificationState = { notifications: Notification[] };

export class NotificationRepo {
  private store = new JsonStore<NotificationState>('notifications.json', { notifications: [] });

  async list(limit = 50): Promise<Notification[]> {
    const s = await this.store.read();
    return s.notifications
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async add(n: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const s = await this.store.read();
    const newN: Notification = { ...n, id: uuidv4(), createdAt: new Date().toISOString() };
    s.notifications.push(newN);
    await this.store.write(s);
    return newN;
  }
}
