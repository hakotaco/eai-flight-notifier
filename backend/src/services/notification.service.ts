import nodemailer from "nodemailer";
import { User } from "../entities/User";
import { Flight } from "../entities/Flight";

interface FlightUpdateMessage {
  flightId: string;
  flightNumber: string;
  scheduleDate: string;
  scheduledDepartureTime: string;
  actualDepartureTime: string | null;
  arrivalTime: string | null;
  origin: string;
  destination: string;
  status: string;
  updateType: "DELAY" | "GATE_CHANGE" | "STATUS_CHANGE" | "TIME_CHANGE" | "CANCELLATION";
  oldDelayMinutes: number;
  newDelayMinutes: number;
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

  async sendSubscriptionConfirmation(
    user: User,
    flightDetails: any,
    subscriptionId: string
  ): Promise<void> {
    try {
      const subject = `Flight Subscription Confirmed - ${flightDetails.flightName || flightDetails.mainFlight}`;
      const body = this.getSubscriptionConfirmationBody(user, flightDetails, subscriptionId);

      console.log(`Sending subscription confirmation to ${user.email}`);
      console.log(`Subject: ${subject}`);

      await this.sendEmail(user.email, subject, body);
    } catch (error) {
      console.error("Error sending subscription confirmation:", error);
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
    const delayMinutes = update.newDelayMinutes;
    const delayText = delayMinutes > 0 
      ? `<p style="color: #f44336;"><strong>Delay:</strong> ${delayMinutes} minutes</p>`
      : `<p style="color: #4caf50;"><strong>Status:</strong> On time</p>`;

    return `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Flight Update Notification</h2>
        <p>Hello ${user.name},</p>
        <p>We have an important update regarding your flight:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Flight Number:</strong> ${update.flightNumber}</p>
          <p><strong>Route:</strong> ${flight.origin} → ${flight.destination}</p>
          <p><strong>Status:</strong> ${flight.status}</p>
          ${delayText}
          <p><strong>Scheduled Departure:</strong> ${new Date(update.scheduledDepartureTime).toLocaleString()}</p>
          ${update.actualDepartureTime ? `<p><strong>New Departure Time:</strong> ${new Date(update.actualDepartureTime).toLocaleString()}</p>` : ""}
          ${update.arrivalTime ? `<p><strong>Estimated Arrival:</strong> ${new Date(update.arrivalTime).toLocaleString()}</p>` : ""}
          <p><strong>Updated:</strong> ${new Date(update.timestamp).toLocaleString()}</p>
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

  private getSubscriptionConfirmationBody(
    user: User,
    flightDetails: any,
    subscriptionId: string
  ): string {
    const flightName = flightDetails.flightName || flightDetails.mainFlight;
    const scheduleTime = flightDetails.scheduleDateTime 
      ? new Date(flightDetails.scheduleDateTime).toLocaleString() 
      : 'N/A';
    const estimatedTime = flightDetails.estimatedTime 
      ? new Date(flightDetails.estimatedTime).toLocaleString() 
      : 'Not yet available';
    const actualTime = flightDetails.actualTime 
      ? new Date(flightDetails.actualTime).toLocaleString() 
      : 'Not yet available';
    const destinations = flightDetails.route?.destinations?.join(', ') || 'N/A';
    const gate = flightDetails.gate || 'Not assigned yet';
    const terminal = flightDetails.terminal || 'N/A';
    const status = flightDetails.flightStates?.join(', ') || 'Scheduled';

    const unsubscribeUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/unsubscribe/${subscriptionId}`;

    return `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">✈️ Flight Subscription Confirmed!</h2>
        <p>Hello ${user.name},</p>
        <p>Thank you for subscribing to flight updates. Here are your flight details:</p>
        
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
          <h3 style="margin-top: 0; color: #2e7d32;">Flight Information</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0;"><strong>Flight Number:</strong></td>
              <td style="padding: 8px 0;">${flightName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Direction:</strong></td>
              <td style="padding: 8px 0;">${flightDetails.flightDirection === 'A' ? 'Arrival' : 'Departure'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Scheduled Time:</strong></td>
              <td style="padding: 8px 0;">${scheduleTime}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Estimated Time:</strong></td>
              <td style="padding: 8px 0;">${estimatedTime}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Actual Time:</strong></td>
              <td style="padding: 8px 0;">${actualTime}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Destination(s):</strong></td>
              <td style="padding: 8px 0;">${destinations}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Gate:</strong></td>
              <td style="padding: 8px 0;">${gate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Terminal:</strong></td>
              <td style="padding: 8px 0;">${terminal}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Status:</strong></td>
              <td style="padding: 8px 0;">${status}</td>
            </tr>
          </table>
        </div>
        
        <p>You will receive email notifications about any significant changes to your flight, including:</p>
        <ul>
          <li>Delays (15+ minutes)</li>
          <li>Gate changes</li>
          <li>Time changes</li>
          <li>Flight cancellations</li>
        </ul>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${unsubscribeUrl}" 
             style="background-color: #f44336; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Unsubscribe from Updates
          </a>
        </div>
        
        <p style="font-size: 12px; color: #666; margin-top: 30px;">
          If you no longer wish to receive these notifications, click the unsubscribe button above or visit: ${unsubscribeUrl}
        </p>
        
        <p>Safe travels,<br/>Flight Notifier Team</p>
      </div>
    `;
  }
}

export default new NotificationService();
export type { FlightUpdateMessage, TrafficUpdateMessage };
