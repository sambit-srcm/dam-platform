import { tmpdir } from 'node:os';
import { z } from 'zod';

// Every environment variable the video worker needs. Nothing else should read process.env.
const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string(),
  DB_POOL_MAX: z.coerce.number().default(10),

  AMQP_URL: z.string(),

  MINIO_ENDPOINT: z.string(),
  MINIO_API_PORT: z.coerce.number().default(9000),
  MINIO_ROOT_USER: z.string(),
  MINIO_ROOT_PASSWORD: z.string(),
  MINIO_BUCKET: z.string(),

  // Transcoding is heavy, so take one job at a time and add replicas to scale
  VIDEO_PREFETCH: z.coerce.number().default(1),
  // Threads given to each ffmpeg process
  FFMPEG_THREADS: z.coerce.number().default(2),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  HEARTBEAT_FILE: z.string().default('/tmp/worker-alive'),
  // Files beyond these limits are rejected instead of being transcoded
  MAX_DURATION_SECONDS: z.coerce.number().default(4 * 60 * 60),
  MAX_DIMENSION_PX: z.coerce.number().default(8192),

  // Where originals and outputs are staged while a job runs
  TMP_DIR: z.string().default(tmpdir()),
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
