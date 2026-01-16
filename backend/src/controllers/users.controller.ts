import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Flight } from '../entities/Flight';
import { UserFlightSubscription } from '../entities/UserFlightSubscription';

/**
 * Get all users with their upcoming flight subscriptions
 * Used by maps-api to periodically check traffic for users
 */
export const getAllUsersWithFlights = async (_req: Request, res: Response): Promise<void> => {
  try {
    const subscriptionRepository = AppDataSource.getRepository(UserFlightSubscription);
    const userRepository = AppDataSource.getRepository(User);
    const flightRepository = AppDataSource.getRepository(Flight);
    
    // Get all active subscriptions for future flights
    const subscriptions = await subscriptionRepository
      .createQueryBuilder('subscription')
      .innerJoin(Flight, 'flight', 'flight.id = subscription.flightId')
      .where('flight.scheduledDepartureTime > :now', { now: new Date() })
      .getMany();

    if (subscriptions.length === 0) {
      res.json([]);
      return;
    }

    // Get user and flight details
    const userIds = [...new Set(subscriptions.map(sub => sub.userId))];
    const flightIds = [...new Set(subscriptions.map(sub => sub.flightId))];

    const users = await userRepository.findByIds(userIds);
    const flights = await flightRepository.findByIds(flightIds);

    // Create maps for quick lookup
    const userMap = new Map(users.map(u => [u.id, u]));
    const flightMap = new Map(flights.map(f => [f.id, f]));

    // Format response for maps-api dashboard client
    const result = subscriptions.map(sub => {
      const user = userMap.get(sub.userId);
      const flight = flightMap.get(sub.flightId);
      
      if (!user || !flight) return null;

      return {
        id: user.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        address: user.homeAddress,
        flightNumber: flight.flightNumber,
        departureTime: flight.scheduledDepartureTime.toISOString(),
        scheduledDeparture: flight.scheduledDepartureTime.toISOString(),
      };
    }).filter(Boolean); // Remove null entries

    res.json(result);
  } catch (error) {
    console.error('Error fetching users with flights:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined 
    });
  }
};
