import { config } from './config.ts';

// Asks RabbitMQ's management API how many jobs are waiting in a queue
// right now, not counting jobs a worker has already picked up.
export async function messagesReady(queueName: string) {
  const url = `${config.RABBITMQ_MGMT_URL}/api/queues/%2F/${queueName}`;
  const credentials = `${config.RABBITMQ_USER}:${config.RABBITMQ_PASSWORD}`;
  const authHeader = 'Basic ' + Buffer.from(credentials).toString('base64');

  const response = await fetch(url, {
    headers: { Authorization: authHeader },
  });

  if (!response.ok) {
    throw new Error(
      `RabbitMQ management API returned ${response.status} for queue "${queueName}"`,
    );
  }

  const body = await response.json();
  return body.messages_ready ?? 0;
}
