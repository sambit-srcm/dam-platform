import { z } from 'zod';

// Every environment variable the autoscaler needs. Nothing else should read process.env.
const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  LOG_LEVEL: z.string().default('info'),

  RABBITMQ_MGMT_URL: z.string().default('http://rabbitmq:15672'),
  RABBITMQ_USER: z.string(),
  RABBITMQ_PASSWORD: z.string(),

  DOCKER_SOCKET_PATH: z.string().default('/var/run/docker.sock'),
  // Prefix Swarm puts in front of every service name, e.g. "dam-platform_worker"
  STACK_NAME: z.string().default('dam-platform'),

  POLL_INTERVAL_MS: z.coerce.number().default(30_000),
  // Consecutive empty polls required before scaling down, so a brief lull doesn't cause flapping
  SCALE_DOWN_COOLDOWN_POLLS: z.coerce.number().default(3),

  IMAGE_QUEUE: z.string().default('dam.image-processing'),
  IMAGE_SERVICE: z.string().default('thumbnail-worker'),
  IMAGE_MIN_REPLICAS: z.coerce.number().default(1),
  IMAGE_MAX_REPLICAS: z.coerce.number().default(6),
  // Add one replica for every this-many messages waiting in the queue
  IMAGE_MESSAGES_PER_REPLICA: z.coerce.number().default(5),

  VIDEO_QUEUE: z.string().default('dam.video-processing'),
  VIDEO_SERVICE: z.string().default('video-worker'),
  VIDEO_MIN_REPLICAS: z.coerce.number().default(1),
  VIDEO_MAX_REPLICAS: z.coerce.number().default(4),
  VIDEO_MESSAGES_PER_REPLICA: z.coerce.number().default(2),
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
