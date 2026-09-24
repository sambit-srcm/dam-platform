import { z } from 'zod';

// Every environment variable the API needs. Nothing else should read process.env.
const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  AMQP_URL: z.string(),

  // How long a single readiness check may take before it counts as down
  HEALTH_TIMEOUT_MS: z.coerce.number().default(2000),

  MINIO_PUBLIC_URL: z.string().default('http://localhost:9000'),
  PRESIGNED_TTL_SECONDS: z.coerce.number().default(60 * 15), // 15 minutes
  THUMBNAIL_TTL_SECONDS: z.coerce.number().default(60 * 60), // longer 1h for browser cache
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Ceiling for a resumable multipart upload
  MAX_UPLOAD_GB: z.coerce.number().default(5),
  // Ceiling for the single-request upload, which is buffered in memory
  MAX_DIRECT_UPLOAD_MB: z.coerce.number().default(25),
  UPLOAD_SESSION_TTL_SECONDS: z.coerce.number().default(60 * 60), // 1 hour
  PART_URL_BATCH_SIZE: z.coerce.number().default(10), // how many presigned part URLs to generate at once
  UPLOAD_CLEANUP_INTERVAL_SECONDS: z.coerce.number().default(60 * 10), // how often abandoned uploads are swept

  // Signs login tokens; generate with `openssl rand -hex 32`
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().default(60 * 60), // 1 hour

  MINIO_ENDPOINT: z.string(),
  MINIO_API_PORT: z.coerce.number().default(9000),
  MINIO_ROOT_USER: z.string(),
  MINIO_ROOT_PASSWORD: z.string(),
  MINIO_BUCKET: z.string(),
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
