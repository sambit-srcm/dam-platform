import { config } from './config.ts';
import { logger } from './logger.ts';
import { messagesReady } from './rabbitmq.ts';
import { getService, scaleService } from './docker.ts';
import { decideReplicaCount, type ScalingRule } from './scaling.ts';

// One entry per worker we're allowed to scale. Everything the loop needs
// to know about that worker lives here, read straight from the config.
const rules: ScalingRule[] = [
  {
    queueName: config.IMAGE_QUEUE,
    serviceName: config.IMAGE_SERVICE,
    minReplicas: config.IMAGE_MIN_REPLICAS,
    maxReplicas: config.IMAGE_MAX_REPLICAS,
    messagesPerReplica: config.IMAGE_MESSAGES_PER_REPLICA,
  },
  {
    queueName: config.VIDEO_QUEUE,
    serviceName: config.VIDEO_SERVICE,
    minReplicas: config.VIDEO_MIN_REPLICAS,
    maxReplicas: config.VIDEO_MAX_REPLICAS,
    messagesPerReplica: config.VIDEO_MESSAGES_PER_REPLICA,
  },
];

const emptyStreaks: Record<string, number> = {
  [config.IMAGE_SERVICE]: 0,
  [config.VIDEO_SERVICE]: 0,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Checks one queue and its worker, and scales the worker if it needs to change.
async function checkOneWorker(rule: ScalingRule) {
  const waitingMessages = await messagesReady(rule.queueName);
  const service = await getService(rule.serviceName);
  const currentReplicas = service.Spec.Mode.Replicated.Replicas;

  const newReplicaCount = decideReplicaCount(
    rule,
    currentReplicas,
    waitingMessages,
    emptyStreaks,
    config.SCALE_DOWN_COOLDOWN_POLLS,
  );

  if (newReplicaCount === currentReplicas) {
    logger.debug(
      { service: rule.serviceName, waitingMessages, currentReplicas },
      'no scaling change needed',
    );
    return;
  }

  logger.info(
    {
      service: rule.serviceName,
      waitingMessages,
      from: currentReplicas,
      to: newReplicaCount,
    },
    'scaling worker',
  );

  await scaleService(rule.serviceName, newReplicaCount);
}

logger.info({ pollIntervalMs: config.POLL_INTERVAL_MS }, 'autoscaler started');

// Runs forever: check every worker, wait, then check again.
while (true) {
  for (const rule of rules) {
    try {
      await checkOneWorker(rule);
    } catch (error) {
      // One worker's check failing must not stop the others from being checked
      logger.error(
        { err: error, service: rule.serviceName },
        'failed to check or scale worker',
      );
    }
  }

  await sleep(config.POLL_INTERVAL_MS);
}
