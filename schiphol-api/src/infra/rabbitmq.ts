// src/infra/rabbitmq.ts

import amqp, { type ChannelModel, type Channel } from "amqplib";

export class RabbitMQService {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private isConnecting = false;

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
    if (this.isConnecting) {
      console.log("[RabbitMQ] Connection attempt already in progress...");
      return;
    }

    try {
      this.isConnecting = true;
      // a.
      const url = `amqp://${this.user}:${this.pass}@${this.host}:${this.port}/${this.vhost}`;
      console.log(`[RabbitMQ] Connecting to ${this.host}/${this.vhost}...`);

      const conn = await amqp.connect(url);
      // b.
      this.connection = conn;
      
      // Set up connection event handlers
      conn.on('error', (err) => {
        console.error('[RabbitMQ] Connection error:', err);
        this.connection = null;
        this.channel = null;
      });
      
      conn.on('close', () => {
        console.warn('[RabbitMQ] Connection closed. Will reconnect on next publish.');
        this.connection = null;
        this.channel = null;
      });
      
      this.channel = await conn.createChannel();
      
      // Set up channel event handlers
      this.channel.on('error', (err) => {
        console.error('[RabbitMQ] Channel error:', err);
        this.channel = null;
      });
      
      this.channel.on('close', () => {
        console.warn('[RabbitMQ] Channel closed.');
        this.channel = null;
      });

      // c. Must match Terraform: type='topic', durable=true
      await this.channel.assertExchange(this.EXCHANGE_NAME, "topic", {
        durable: true,
      });
      console.log("[RabbitMQ] Connected and Channel established.");
    } catch (error) {
      console.error("[RabbitMQ] Connection failed:", error);
      this.connection = null;
      this.channel = null;
      // d.
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Ensures connection is active, reconnecting if needed.
   */
  private async ensureConnection(): Promise<void> {
    if (!this.channel || !this.connection) {
      console.log("[RabbitMQ] Connection lost, attempting to reconnect...");
      await this.connect();
    }
  }

  /**
   * Publishes a domain event to the Exchange.
   * @param routingKey e.g., "flight.delayed", "flight.cancelled"
   * @param message The payload object (will be JSON stringified)
   */
  async publish(routingKey: string, message: object): Promise<boolean> {
    try {
      // a. Ensure connection is active
      await this.ensureConnection();
      
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
    } catch (error) {
      console.error(`[RabbitMQ] Failed to publish to '${routingKey}':`, error);
      // Reset connection on error
      this.connection = null;
      this.channel = null;
      throw error;
    }
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
