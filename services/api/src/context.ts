import { createDb, type Db } from '@dam/db';
import { connectJobQueue, type JobQueue } from '@dam/queue';
import { Client as MinioClient } from 'minio';
import { createClient, type RedisClientType } from 'redis';
import { config } from './config.ts';
import { logger } from './logger.ts';

// The clients the routes work with, created once at startup
export type Context = {
  db: Db;
  queue: JobQueue;
  redis: RedisClientType;
  storage: MinioClient;
  bucket: string;
  close(): Promise<void>;
};

export async function createContext(): Promise<Context> {
  const db = createDb(config.DATABASE_URL);
  const queue = await connectJobQueue(config.AMQP_URL);

  const redis = createClient({ url: config.REDIS_URL }) as RedisClientType;
  // Without a listener, a connection error would crash the process
  redis.on('error', (error) => logger.error({ err: error }, 'redis error'));
  await redis.connect();

  const storage = new MinioClient({
    endPoint: config.MINIO_ENDPOINT,
    port: config.MINIO_API_PORT,
    useSSL: false,
    accessKey: config.MINIO_ROOT_USER,
    secretKey: config.MINIO_ROOT_PASSWORD,
  });

  return {
    db,
    queue,
    redis,
    storage,
    bucket: config.MINIO_BUCKET,
    async close() {
      await queue.close();
      await redis.close();
      await db.$client.end();
    },
  };
}
