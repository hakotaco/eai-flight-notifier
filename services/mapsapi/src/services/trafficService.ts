import { User, Notification } from '../types';
import { mapsClient } from './googleMaps';
import { NotificationRepo } from '../repos/notificationRepo';
import { rabbit } from './rabbit';
import { config } from '../config';

export class TrafficService {
  constructor(private notifications: NotificationRepo) {}

  async checkUser(user: User): Promise<Notification> {
    const destination = config.schipholAddress;
    const origin = user.address;
    const traffic = await mapsClient.assessTraffic(origin, destination);
    const notification: Omit<Notification, 'id' | 'createdAt'> = {
      userId: user.id,
      flightNumber: user.flightNumber,
      destination,
      origin,
      traffic,
    };
    const saved = await this.notifications.add(notification);
    await rabbit.publish({ type: 'TRAFFIC_NOTIFICATION', payload: saved });
    return saved;
  }
}
