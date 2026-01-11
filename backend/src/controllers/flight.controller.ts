import { AppDataSource } from "../config/database";
import { User } from "../entities/User";
import { Flight } from "../entities/Flight";
import { UserFlightSubscription } from "../entities/UserFlightSubscription";
import notificationService, {
  FlightUpdateMessage,
  TrafficUpdateMessage,
} from "../services/notification.service";

export const handleFlightUpdate = async (
  message: FlightUpdateMessage
): Promise<void> => {
  try {
    console.log("Processing flight update:", message);

    const flightRepository = AppDataSource.getRepository(Flight);
    const userRepository = AppDataSource.getRepository(User);
    const subscriptionRepository =
      AppDataSource.getRepository(UserFlightSubscription);

    // First check if anyone is subscribed to this flight
    const subscriptions = await subscriptionRepository.find({
      where: { flightId: message.flightId },
    });

    if (subscriptions.length === 0) {
      console.log(
        `No users subscribed to flight ${message.flightNumber}, skipping update`
      );
      return;
    }

    console.log(
      `Found ${subscriptions.length} users subscribed to flight ${message.flightNumber}`
    );

    // Find or create the flight
    let flight = await flightRepository.findOne({
      where: { id: message.flightId },
    });

    if (!flight) {
      // Create flight from message data
      flight = flightRepository.create({
        id: message.flightId,
        flightNumber: message.flightNumber,
        scheduleDate: message.scheduleDate,
        scheduledDepartureTime: new Date(message.scheduledDepartureTime),
        actualDepartureTime: message.actualDepartureTime ? new Date(message.actualDepartureTime) : null,
        arrivalTime: message.arrivalTime ? new Date(message.arrivalTime) : null,
        origin: message.origin,
        destination: message.destination,
        status: message.status as any,
        lastUpdated: new Date(),
      });
    } else {
      // Update existing flight with new data
      flight.actualDepartureTime = message.actualDepartureTime ? new Date(message.actualDepartureTime) : null;
      flight.arrivalTime = message.arrivalTime ? new Date(message.arrivalTime) : null;
      flight.origin = message.origin;
      flight.destination = message.destination;
      flight.status = message.status as any;
      flight.lastUpdated = new Date();
    }

    await flightRepository.save(flight);

    // Send notifications to all subscribed users
    for (const subscription of subscriptions) {
      const user = await userRepository.findOne({
        where: { id: subscription.userId },
      });

      if (!user) {
        console.error(`User not found for subscription: ${subscription.userId}`);
        continue;
      }

      try {
        await notificationService.sendFlightUpdateNotification(
          user,
          flight,
          message
        );
        console.log(`Notification sent to ${user.email}`);
      } catch (error) {
        console.error(`Failed to send notification to ${user.email}:`, error);
      }
    }

    console.log(
      `Flight update processed for flight ${message.flightNumber}, notified ${subscriptions.length} users`
    );
  } catch (error) {
    console.error("Error handling flight update:", error);
    throw error;
  }
};

export const handleTrafficUpdate = async (
  message: TrafficUpdateMessage
): Promise<void> => {
  try {
    console.log("Processing traffic update:", message);

    const userRepository = AppDataSource.getRepository(User);

    // Find the user
    const user = await userRepository.findOne({
      where: { id: message.userId },
    });

    if (!user) {
      console.error(`User not found: ${message.userId}`);
      return;
    }

    // Send traffic notification to the user
    await notificationService.sendTrafficUpdateNotification(user, message);

    console.log(
      `Traffic update processed and notification sent for user ${user.email}`
    );
  } catch (error) {
    console.error("Error handling traffic update:", error);
    throw error;
  }
};
