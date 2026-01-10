import nodemailer from "nodemailer";
import { User } from "../entities/User";
import { Flight } from "../entities/Flight";

interface FlightUpdateMessage {
  flightId: string;
  flightNumber: string;
  updateType: "DELAY" | "GATE_CHANGE" | "STATUS_CHANGE" | "TIME_CHANGE" | "CANCELLATION";
  oldValue?: string;
  newValue: string;
  timestamp: string;
}

interface TrafficUpdateMessage {
  userId: string;
  origin: string;
  destination: string;
  travelTime: number; // in minutes
  delay: number; // in minutes
  estimatedArrival: string;
  timestamp: string;
}

class NotificationService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configure with Gmail
    // To use Gmail, you need to generate an App Password:
    // 1. Go to https://myaccount.google.com/security
    // 2. Enable 2-Step Verification if not already enabled
    // 3. Go to https://myaccount.google.com/apppasswords
    // 4. Generate an app password for "Mail"
    // 5. Use that password in SMTP_PASS environment variable
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
    });
  }

  async sendFlightUpdateNotification(
    user: User,
    flight: Flight,
    update: FlightUpdateMessage
  ): Promise<void> {
    try {
      const subject = this.getFlightUpdateSubject(update);
      const body = this.getFlightUpdateBody(user, flight, update);

      console.log(`Sending flight update notification to ${user.email}`);
      console.log(`Subject: ${subject}`);
      console.log(`Update: ${update.updateType}`);

      await this.sendEmail(user.email, subject, body);
    } catch (error) {
      console.error("Error sending flight update notification:", error);
      throw error;
    }
  }

  async sendTrafficUpdateNotification(
    user: User,
    update: TrafficUpdateMessage
  ): Promise<void> {
    try {
      const subject = `Traffic Alert: ${update.delay} min delay to ${update.destination}`;
      const body = this.getTrafficUpdateBody(user, update);

      console.log(`Sending traffic update notification to ${user.email}`);
      console.log(`Subject: ${subject}`);

      await this.sendEmail(user.email, subject, body);
    } catch (error) {
      console.error("Error sending traffic update notification:", error);
      throw error;
    }
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER || "noreply@flightnotifier.com",
        to,
        subject,
        html,
      });
      console.log(`Email sent successfully to ${to}`);
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }

  private getFlightUpdateSubject(update: FlightUpdateMessage): string {
    switch (update.updateType) {
      case "DELAY":
        return `Flight ${update.flightNumber} Delayed`;
      case "CANCELLATION":
        return `Flight ${update.flightNumber} Cancelled`;
      case "GATE_CHANGE":
        return `Gate Change for Flight ${update.flightNumber}`;
      case "STATUS_CHANGE":
        return `Status Update for Flight ${update.flightNumber}`;
      case "TIME_CHANGE":
        return `Time Change for Flight ${update.flightNumber}`;
      default:
        return `Update for Flight ${update.flightNumber}`;
    }
  }

  private getFlightUpdateBody(
    user: User,
    flight: Flight,
    update: FlightUpdateMessage
  ): string {
    const delayInfo =
      flight.actualDepartureTime && flight.scheduledDepartureTime
        ? `
          <p><strong>Originally Scheduled:</strong> ${flight.scheduledDepartureTime.toLocaleString()}</p>
          <p><strong>New Departure Time:</strong> ${flight.actualDepartureTime.toLocaleString()}</p>
        `
        : "";

    return `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Flight Update Notification</h2>
        <p>Hello ${user.name},</p>
        <p>We have an important update regarding your flight:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Flight Number:</strong> ${update.flightNumber}</p>
          <p><strong>Route:</strong> ${flight.origin} → ${flight.destination}</p>
          <p><strong>Update Type:</strong> ${update.updateType}</p>
          ${delayInfo}
          ${update.oldValue ? `<p><strong>Previous:</strong> ${update.oldValue}</p>` : ""}
          <p><strong>New Information:</strong> ${update.newValue}</p>
          <p><strong>Time:</strong> ${new Date(update.timestamp).toLocaleString()}</p>
        </div>
        <p>Please check your flight details for the most up-to-date information.</p>
        <p>Safe travels,<br/>Flight Notifier Team</p>
      </div>
    `;
  }

  private getTrafficUpdateBody(
    user: User,
    update: TrafficUpdateMessage
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Traffic Alert</h2>
        <p>Hello ${user.name},</p>
        <p>We've detected traffic on your route to the airport:</p>
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>From:</strong> ${update.origin}</p>
          <p><strong>To:</strong> ${update.destination}</p>
          <p><strong>Current Travel Time:</strong> ${update.travelTime} minutes</p>
          <p><strong>Delay:</strong> ${update.delay} minutes</p>
          <p><strong>Estimated Arrival:</strong> ${new Date(update.estimatedArrival).toLocaleTimeString()}</p>
        </div>
        <p>We recommend leaving earlier to ensure you arrive at the airport on time.</p>
        <p>Safe travels,<br/>Flight Notifier Team</p>
      </div>
    `;
  }
}

export default new NotificationService();
export type { FlightUpdateMessage, TrafficUpdateMessage };
