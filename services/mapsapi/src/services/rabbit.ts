import amqplib from 'amqplib';
import { config } from '../config';

export class RabbitClient {
  // Use loose typing to avoid conflicts between bundled vs. @types amqplib declarations
  private conn?: any;
  private ch?: any;
  private ready = false;

  async connect(): Promise<void> {
    if (this.ready) return;
    const conn = await amqplib.connect(config.rabbitmqUrl);
    this.conn = conn;
    conn.on('error', () => { this.ready = false; });
    conn.on('close', () => { this.ready = false; });
    const ch = await conn.createChannel();
    this.ch = ch;
    await ch.assertExchange(config.rabbitmqExchange, 'fanout', { durable: true });
    this.ready = true;
  }

  async publish(message: any): Promise<void> {
    if (!this.ready) {
      await this.connect();
    }
    const body = Buffer.from(JSON.stringify(message));
    if (!this.ch) throw new Error('RabbitMQ channel is not available');
    this.ch.publish(
      config.rabbitmqExchange,
      '',
      body,
      { contentType: 'application/json', persistent: true }
    );
  }
}

export const rabbit = new RabbitClient();
