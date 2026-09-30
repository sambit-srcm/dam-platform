export type ScalingRule = {
  queueName: string;
  serviceName: string;
  minReplicas: number;
  maxReplicas: number;
  messagesPerReplica: number;
};

// Works out how many replicas a worker should have, given how many jobs
// are waiting for it right now.
export function decideReplicaCount(
  rule: ScalingRule,
  currentReplicas: number,
  waitingMessages: number,
  emptyStreaks: Record<string, number>,
  scaleDownCooldownPolls: number,
) {
  if (waitingMessages === 0) {
    emptyStreaks[rule.serviceName] = (emptyStreaks[rule.serviceName] ?? 0) + 1;

    const emptyLongEnough =
      emptyStreaks[rule.serviceName]! >= scaleDownCooldownPolls;

    if (emptyLongEnough && currentReplicas > rule.minReplicas) {
      return currentReplicas - 1;
    }

    return currentReplicas;
  }

  // Any jobs waiting resets the "empty" counter
  emptyStreaks[rule.serviceName] = 0;

  const replicasNeeded = Math.ceil(waitingMessages / rule.messagesPerReplica);

  if (replicasNeeded > rule.maxReplicas) return rule.maxReplicas;
  if (replicasNeeded < rule.minReplicas) return rule.minReplicas;
  return replicasNeeded;
}
