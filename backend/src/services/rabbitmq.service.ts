import * as amqp from 'amqplib';

class RabbitMQService {
  // Flight-domain connection (topic exchange in vhost: flight_ops)
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;

  // Traffic notifications connection (fanout exchange in default vhost)
  private trafficConnection: amqp.ChannelModel | null = null;
  private trafficChannel: amqp.Channel | null = null;

  private readonly url: string;

  constructor() {
    this.url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  }

  async connect(): Promise<void> {
    try {
      console.log('Connecting to RabbitMQ...');
      // Connect to the flight_ops vhost to match schiphol-api
      const urlWithVhost = this.url.endsWith('/') 
        ? this.url + 'flight_ops' 
        : this.url + '/flight_ops';
      
      this.connection = await amqp.connect(urlWithVhost);
      this.channel = await this.connection.createChannel();
      
      // Declare the exchange (must match schiphol-api)
      const exchangeName = 'flight.events';
      await this.channel.assertExchange(exchangeName, 'topic', {
        durable: true,
      });

      // Declare queues
      if (this.channel) {
        const flightQueue = process.env.FLIGHT_UPDATES_QUEUE || 'flight.delayed';

        await this.channel.assertQueue(flightQueue, {
          durable: true,
        });

        // Bind the flight queue to the exchange with the routing key
        await this.channel.bindQueue(flightQueue, exchangeName, flightQueue);

        console.log(`Queue '${flightQueue}' bound to exchange '${exchangeName}' with routing key '${flightQueue}'`);
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

      // --- Separate connection for traffic.notifications fanout (default vhost) ---
      // Allow override via TRAFFIC_RABBITMQ_URL; otherwise derive base URL without vhost suffix
      const trafficUrl = process.env.TRAFFIC_RABBITMQ_URL || this.stripVHost(this.url);
      this.trafficConnection = await amqp.connect(trafficUrl);
      this.trafficChannel = await this.trafficConnection.createChannel();

      const trafficExchange = process.env.RABBITMQ_EXCHANGE || 'traffic.notifications';
      const trafficQueue = process.env.TRAFFIC_UPDATES_QUEUE || 'traffic_updates';
      await this.trafficChannel.assertExchange(trafficExchange, 'fanout', { durable: true });
      await this.trafficChannel.assertQueue(trafficQueue, { durable: true });
      await this.trafficChannel.bindQueue(trafficQueue, trafficExchange, '');
      console.log(`Queue '${trafficQueue}' bound to fanout exchange '${trafficExchange}'`);

      if (this.trafficConnection) {
        this.trafficConnection.on('error', (err) => {
          console.error('RabbitMQ (traffic) connection error:', err);
        });
        this.trafficConnection.on('close', () => {
          console.log('RabbitMQ (traffic) connection closed. Reconnecting...');
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

    const queue = process.env.FLIGHT_UPDATES_QUEUE || 'flight.delayed';
    
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
    if (!this.trafficChannel) {
      throw new Error('RabbitMQ traffic channel not initialized');
    }

    const queue = process.env.TRAFFIC_UPDATES_QUEUE || 'traffic_updates';

    await this.trafficChannel.consume(
      queue,
      async (msg) => {
        if (msg) {
          try {
            const raw = JSON.parse(msg.content.toString());
            const mapped = this.mapTrafficNotification(raw);
            await callback(mapped);
            this.trafficChannel!.ack(msg);
          } catch (error) {
            console.error('Error processing traffic update:', error);
            this.trafficChannel!.nack(msg, false, false);
          }
        }
      },
      { noAck: false }
    );

    console.log(`Listening for traffic notifications on queue: ${queue}`);
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      await this.trafficChannel?.close();
      await this.trafficConnection?.close();
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

  // --- Helpers ---
  private stripVHost(url: string): string {
    // Remove any "/<vhost>" suffix if present, leaving base host:port
    try {
      // If URL already has a vhost segment, drop it
      // e.g., amqp://user:pass@host:5672/flight_ops -> amqp://user:pass@host:5672
      const idx = url.lastIndexOf('/');
      if (idx > 'amqp://'.length) {
        return url.substring(0, idx);
      }
      return url;
    } catch {
      return url;
    }
  }

  private mapTrafficNotification(raw: any): any {
    // Expecting maps-api payload: { type: 'TRAFFIC_NOTIFICATION', payload: { ... } }
    const p = raw && raw.payload ? raw.payload : raw;
    const createdAt = p?.createdAt ? new Date(p.createdAt) : new Date();
    const trafficDurationSec = Number(p?.traffic?.trafficDurationSec || 0);
    const delaySec = Number(p?.traffic?.delaySec || 0);

    const travelTimeMin = Math.max(0, Math.round(trafficDurationSec / 60));
    const delayMin = Math.max(0, Math.round(delaySec / 60));
    const estimatedArrival = new Date(createdAt.getTime() + trafficDurationSec * 1000).toISOString();

    return {
      userId: p?.userId,
      origin: p?.origin,
      destination: p?.destination,
      travelTime: travelTimeMin,
      delay: delayMin,
      estimatedArrival,
      timestamp: createdAt.toISOString(),
    };
  }
}

export default new RabbitMQService();
