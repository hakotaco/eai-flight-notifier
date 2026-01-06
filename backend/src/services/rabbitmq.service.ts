import * as amqp from 'amqplib';

class RabbitMQService {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly url: string;

  constructor() {
    this.url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  }

  async connect(): Promise<void> {
    try {
      console.log('Connecting to RabbitMQ...');
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      
      // Declare queues
      if (this.channel) {
        await this.channel.assertQueue(process.env.FLIGHT_UPDATES_QUEUE || 'flight_updates', {
          durable: true,
        });
        await this.channel.assertQueue(process.env.TRAFFIC_UPDATES_QUEUE || 'traffic_updates', {
          durable: true,
        });
      }

      console.log('Connected to RabbitMQ successfully');

      // Handle connection errors
      if (this.connection) {
        this.connection.on('error', (err) => {
          console.error('RabbitMQ connection error:', err);
        });

        this.connection.on('close', () => {
          console.log('RabbitMQ connection closed. Reconnecting...');
          setTimeout(() => this.connect(), 5000);
        });
      }
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async consumeFlightUpdates(callback: (message: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const queue = process.env.FLIGHT_UPDATES_QUEUE || 'flight_updates';
    
    await this.channel.consume(
      queue,
      async (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            await callback(content);
            this.channel!.ack(msg);
          } catch (error) {
            console.error('Error processing flight update:', error);
            this.channel!.nack(msg, false, false);
          }
        }
      },
      { noAck: false }
    );

    console.log(`Listening for messages on queue: ${queue}`);
  }

  async consumeTrafficUpdates(callback: (message: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const queue = process.env.TRAFFIC_UPDATES_QUEUE || 'traffic_updates';
    
    await this.channel.consume(
      queue,
      async (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            await callback(content);
            this.channel!.ack(msg);
          } catch (error) {
            console.error('Error processing traffic update:', error);
            this.channel!.nack(msg, false, false);
          }
        }
      },
      { noAck: false }
    );

    console.log(`Listening for messages on queue: ${queue}`);
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      console.log('RabbitMQ connection closed');
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
  }

  getChannel(): amqp.Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }
    return this.channel;
  }
}

export default new RabbitMQService();
