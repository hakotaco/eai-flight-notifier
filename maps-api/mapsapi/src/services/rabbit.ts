import amqplib from 'amqplib';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { User } from '../types';

export class RabbitClient {
  // Use loose typing to avoid conflicts between bundled vs. @types amqplib declarations
  private conn?: any;
  private ch?: any;
  private ready = false;
  private replyQueue?: string; // for RPC replies from Schiphol service
  private pending = new Map<string, { resolve: (v: any)=>void; reject: (e: any)=>void; timer: NodeJS.Timeout }>();

  async connect(): Promise<void> {
    if (this.ready) return;
    const conn = await amqplib.connect(config.rabbitmqUrl);
    this.conn = conn;
    conn.on('error', () => { this.ready = false; });
    conn.on('close', () => { this.ready = false; });
    const ch = await conn.createChannel();
    this.ch = ch;
    // Exchange for outbound traffic notifications (fanout)
    await ch.assertExchange(config.rabbitmqExchange, 'fanout', { durable: true });
    // Queue from dashboard that pushes traveler messages
    await ch.assertQueue(config.dashboardTravelersQueue, { durable: true });
    // Queue for Schiphol arrival RPC requests (consumed by schiphol-api)
    await ch.assertQueue(config.schipholArrivalRequestQueue, { durable: true });

    // Create a private exclusive reply queue for RPC responses
    const qok = await ch.assertQueue('', { exclusive: true, durable: false, autoDelete: true });
    this.replyQueue = qok.queue;
    await ch.consume(this.replyQueue, (msg: any) => this.onRpcMessage(msg), { noAck: true });
    this.ready = true;
  }

  // Publish traffic notification to fanout exchange
  async publishTraffic(message: any): Promise<void> {
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

  // Consume traveler push messages from the dashboard
  async consumeTravelers(handler: (u: User) => Promise<void>): Promise<void> {
    if (!this.ready) {
      await this.connect();
    }
    if (!this.ch) throw new Error('RabbitMQ channel is not available');
    await this.ch.consume(
      config.dashboardTravelersQueue,
      async (msg: any) => {
        if (!msg) return;
        try {
          const content = msg.content ? JSON.parse(msg.content.toString()) : undefined;
          // Normalize minimal User shape
          const u: User = {
            id: String(content?.id ?? content?.userId ?? ''),
            address: String(content?.address ?? ''),
            flightNumber: String(content?.flightNumber ?? ''),
            email: content?.email,
            name: content?.name,
            departureTime: content?.departureTime,
          };
          if (!u.id || !u.address || !u.flightNumber) {
            throw new Error('Invalid traveler payload');
          }
          await handler(u);
          this.ch.ack(msg);
        } catch (err) {
          console.error('[Rabbit] Traveler handler failed:', (err as any)?.message || err);
          // Nack with requeue=false to avoid tight loops; adjust if DLX is configured
          this.ch.nack(msg, false, false);
        }
      },
      { noAck: false }
    );
  }

  // RPC request to Schiphol for arrival info
  async rpcSchipholArrival(req: { flightNumber: string; date?: string; direction?: 'A'|'D' }): Promise<any> {
    if (!this.ready) {
      await this.connect();
    }
    if (!this.ch || !this.replyQueue) throw new Error('RabbitMQ channel/reply queue not available');
    const correlationId = randomUUID();
    const payload = Buffer.from(JSON.stringify(req));

    const promise = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(new Error('RPC timeout'));
      }, config.rpcTimeoutMs);
      this.pending.set(correlationId, { resolve, reject, timer });
    });

    this.ch.sendToQueue(
      config.schipholArrivalRequestQueue,
      payload,
      { correlationId, replyTo: this.replyQueue, contentType: 'application/json' }
    );
    return promise;
  }

  private onRpcMessage(msg: any) {
    try {
      const corr = msg.properties?.correlationId as string | undefined;
      if (!corr) return;
      const entry = this.pending.get(corr);
      if (!entry) return;
      this.pending.delete(corr);
      clearTimeout(entry.timer);
      const data = msg.content ? JSON.parse(msg.content.toString()) : undefined;
      entry.resolve(data);
    } catch (err) {
      console.error('[Rabbit] RPC handler error:', (err as any)?.message || err);
    }
  }
}

export const rabbit = new RabbitClient();
