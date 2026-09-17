import { z } from 'zod';

// Every environment variable the worker needs. Nothing else should read process.env.
const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string(),
  AMQP_URL: z.string(),

  MINIO_ENDPOINT: z.string(),
  MINIO_API_PORT: z.coerce.number().default(9000),
  MINIO_ROOT_USER: z.string(),
  MINIO_ROOT_PASSWORD: z.string(),
  MINIO_BUCKET: z.string(),

  // Width of the generated thumbnail, in pixels
  THUMBNAIL_WIDTH: z.coerce.number().default(400),
  // How many jobs this worker takes at a time
  WORKER_PREFETCH: z.coerce.number().default(2),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment variables:\n${problems}`);
  process.exit(1);
}

export const config = parsed.data;
