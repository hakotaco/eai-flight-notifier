// src/scripts/test-mq.ts

import { RabbitMQService } from "../infra/rabbitmq";

async function runTest() {
  const mq = new RabbitMQService();

  try {
    // 1. Connect
    await mq.connect();

    // 2. Publish
    const payload = {
      flight: "TEST-001",
      status: "DELAYED",
      delayMinutes: 45,
      timestamp: new Date().toISOString(),
    };

    await mq.publish("flight.delayed", payload);
    console.log("Test message published successfully.");

    // [Fix] Wait for the network buffer to flush before killing the connection
    console.log("Waiting for network flush...");
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    // 3. Cleanup
    await mq.disconnect();
  }
}

runTest();
