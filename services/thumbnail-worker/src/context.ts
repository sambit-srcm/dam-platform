import { createDb, DB_POOL_LIMITS, type Db } from '@dam/db';
import { connectJobQueue, type JobQueue } from '@dam/queue';
import { Client as MinioClient } from 'minio';
import { config } from './config.ts';
import { logger } from './logger.ts';

// The clients the worker uses, created once at startup
export type Context = {
  db: Db;
  queue: JobQueue;
  storage: MinioClient;
  bucket: string;
  close(): Promise<void>;
};

export async function createContext(): Promise<Context> {
  const db = createDb(config.DATABASE_URL, {
    maxConnections: config.DB_POOL_MAX,
    ...DB_POOL_LIMITS,
  });
  db.$client.on('error', (error: Error) => {
    logger.error({ err: error }, 'database pool error');
  });
  const queue = await connectJobQueue(config.AMQP_URL);

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
    storage,
    bucket: config.MINIO_BUCKET,
    async close() {
      await queue.close();
      await db.$client.end();
    },
  };
}
