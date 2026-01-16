import { v4 as uuidv4 } from 'uuid';
import { User, Notification } from '../types';
import { mapsClient } from './googleMaps';
import { rabbit } from './rabbit';
import { config } from '../config';

export class TrafficService {
  constructor() {}

  async checkUser(user: User): Promise<Notification> {
    const destination = config.schipholAddress;
    const origin = user.address;
    const traffic = await mapsClient.assessTraffic(origin, destination);
    // Try to fetch arrival info via RabbitMQ RPC (non-fatal if it fails)
    let flightArrival: Notification['flightArrival'] | undefined;
    try {
      const date = user.departureTime ? new Date(user.departureTime).toISOString().split('T')[0] : undefined;
      const arrival = await rabbit.rpcSchipholArrival({
        flightNumber: user.flightNumber,
        date,
        direction: 'A',
      });
      if (arrival && typeof arrival === 'object') {
        flightArrival = arrival;
      }
    } catch (e) {
      // Ignore RPC failure; proceed with traffic-only notification
    }

    const payload: Notification = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      userId: user.id,
      flightNumber: user.flightNumber,
      destination,
      origin,
      traffic,
      ...(flightArrival ? { flightArrival } : {}),
    };

    await rabbit.publishTraffic({ type: 'TRAFFIC_NOTIFICATION', payload: payload });
    return payload;
  }
}
