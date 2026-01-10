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

    // Find the flight
    const flight = await flightRepository.findOne({
      where: { id: message.flightId },
    });

    if (!flight) {
      console.error(`Flight not found: ${message.flightId}`);
      return;
    }

    // Update flight information based on update type
    switch (message.updateType) {
      case "DELAY":
      case "TIME_CHANGE":
        if (message.newValue) {
          flight.actualDepartureTime = new Date(message.newValue);
        }
        break;
      case "STATUS_CHANGE":
        flight.status = message.newValue as any;
        break;
      case "GATE_CHANGE":
        // Gate info would be stored if we had a gate field
        break;
      case "CANCELLATION":
        flight.status = "CANCELLED" as any;
        break;
    }

    flight.lastUpdated = new Date();
    await flightRepository.save(flight);

    // Find all users subscribed to this flight
    const subscriptions = await subscriptionRepository.find({
      where: { flightId: flight.id },
    });

    console.log(
      `Found ${subscriptions.length} users subscribed to flight ${message.flightNumber}`
    );

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
