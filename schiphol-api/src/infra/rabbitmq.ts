// src/infra/rabbitmq.ts

import amqp, { type ChannelModel, type Channel } from "amqplib";

export class RabbitMQService {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  // This must exactly match the Exchange name defined in Terraform
  private readonly EXCHANGE_NAME = "flight.events";

  constructor(
    private readonly host = process.env.MQ_HOST || "localhost",
    private readonly port = process.env.MQ_PORT || "5672",
    private readonly user = process.env.MQ_USER || "admin",
    private readonly pass = process.env.MQ_PASS || "password",
    private readonly vhost = "flight_ops" // Terraform created this vhost
  ) {}

  /**
   * Initializes the connection to the RabbitMQ Cluster.
   * Note the VHost in the connection string.
   */
  async connect(): Promise<void> {
    try {
      // a.
      const url = `amqp://${this.user}:${this.pass}@${this.host}:${this.port}/${this.vhost}`;
      console.log(`[RabbitMQ] Connecting to ${this.host}/${this.vhost}...`);

      const conn = await amqp.connect(url);
      // b.
      this.connection = conn;
      this.channel = await conn.createChannel();

      // c. Must match Terraform: type='topic', durable=true
      await this.channel.assertExchange(this.EXCHANGE_NAME, "topic", {
        durable: true,
      });
      console.log("[RabbitMQ] Connected and Channel established.");
    } catch (error) {
      console.error("[RabbitMQ] Connection failed:", error);
      // d.
      throw error;
    }
  }

  /**
   * Publishes a domain event to the Exchange.
   * @param routingKey e.g., "flight.delayed", "flight.cancelled"
   * @param message The payload object (will be JSON stringified)
   */
  async publish(routingKey: string, message: object): Promise<boolean> {
    // a.
    if (!this.channel) {
      throw new Error(
        "[RabbitMQ] Channel not initialized. Call connect() first."
      );
    }
    // b.
    const buffer = Buffer.from(JSON.stringify(message));
    // c.
    const sent = this.channel.publish(this.EXCHANGE_NAME, routingKey, buffer);
    if (sent) {
      console.log(`[RabbitMQ] Sent message to '${routingKey}'`);
    } else {
      console.warn(
        `[RabbitMQ] Channel buffer full, message to '${routingKey}' might be delayed.`
      );
    }

    return sent;
  }

  /**
   * Gracefully closes the connection.
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      console.log("[RabbitMQ] Connection closed.");
    }
  }
}
