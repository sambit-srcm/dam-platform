import { describe, expect, it } from 'vitest';
import { decideReplicaCount, type ScalingRule } from '../scaling.ts';

const rule: ScalingRule = {
  queueName: 'jobs',
  serviceName: 'worker',
  minReplicas: 1,
  maxReplicas: 6,
  messagesPerReplica: 5,
};
const COOLDOWN = 3;

// Each test starts with a fresh memory of how long the queue has been empty
const decide = (
  current: number,
  waiting: number,
  streaks: Record<string, number> = {},
  r = rule,
) => decideReplicaCount(r, current, waiting, streaks, COOLDOWN);

describe('adding workers when jobs pile up', () => {
  it('adds one worker for every 5 waiting jobs', () => {
    expect(decide(1, 5)).toBe(1);
    expect(decide(1, 6)).toBe(2);
    expect(decide(1, 15)).toBe(3);
    expect(decide(1, 16)).toBe(4);
  });

  it('jumps straight to what is needed, not one at a time', () => {
    expect(decide(1, 25)).toBe(5);
  });

  it('never goes above the maximum', () => {
    expect(decide(1, 10_000)).toBe(6);
  });

  it('scales down straight away to fit a smaller backlog, as long as jobs are waiting', () => {
    expect(decide(6, 5)).toBe(1);
  });

  it('never goes below the minimum while jobs are waiting', () => {
    expect(decide(3, 1, {}, { ...rule, minReplicas: 2 })).toBe(2);
  });

  it('is more eager for heavy work like video', () => {
    const video = { ...rule, messagesPerReplica: 2, maxReplicas: 4 };
    expect(decide(1, 5, {}, video)).toBe(3);
    expect(decide(1, 100, {}, video)).toBe(4);
  });
});

describe('removing workers when the queue is quiet', () => {
  it('waits for several quiet checks in a row before removing anyone', () => {
    const streaks = {};
    expect(decide(4, 0, streaks)).toBe(4);
    expect(decide(4, 0, streaks)).toBe(4);
    expect(decide(4, 0, streaks)).toBe(3);
  });

  it('removes only one worker at a time', () => {
    const streaks = { worker: 10 };
    expect(decide(4, 0, streaks)).toBe(3);
  });

  it('restarts the countdown as soon as a job shows up', () => {
    const streaks = {};
    decide(4, 0, streaks);
    decide(4, 0, streaks);
    decide(4, 3, streaks);

    expect(streaks).toEqual({ worker: 0 });
    expect(decide(4, 0, streaks)).toBe(4);
  });

  it('never removes the last allowed worker', () => {
    const streaks = { worker: 100 };
    expect(decide(1, 0, streaks)).toBe(1);
  });

  it('respects a higher minimum', () => {
    const streaks = { worker: 100 };
    expect(decide(2, 0, streaks, { ...rule, minReplicas: 2 })).toBe(2);
  });

  it('counts quiet time separately for each kind of worker', () => {
    const streaks = {};
    const other = { ...rule, serviceName: 'other-worker' };

    decide(4, 0, streaks);
    decide(4, 0, streaks);
    decide(4, 5, streaks, other);

    expect(streaks).toEqual({ worker: 2, 'other-worker': 0 });
    expect(decide(4, 0, streaks)).toBe(3);
  });
});
