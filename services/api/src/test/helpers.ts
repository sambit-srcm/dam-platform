import type { Asset } from '@dam/db';
import { vi } from 'vitest';
import type { Context } from '../shared/lib/context.ts';
import type { AuthUser } from '../shared/lib/actor.ts';
import { signToken } from '../shared/lib/token.ts';

export const alice: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'user',
};
export const bob: AuthUser = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'user',
};
export const admin: AuthUser = {
  id: '33333333-3333-4333-8333-333333333333',
  role: 'admin',
};

export const ASSET_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// An asset that belongs to Alice and is ready to use; pass only what a test cares about
export function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: ASSET_ID,
    filename: 'beach.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    ownerId: alice.id,
    storageKey: 'images/beach.jpg',
    thumbnailKey: 'thumbnails/beach.webp',
    status: 'ready',
    upload: null,
    metadata: null,
    tags: ['beach'],
    uploadExpiresAt: null,
    downloadCount: 0,
    failureReason: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

// A stand-in for the database, Redis, storage and queue, where every call is recorded
export function makeCtx() {
  const redis = {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
    mGet: vi.fn().mockResolvedValue([]),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    hSet: vi.fn().mockResolvedValue(1),
    hGetAll: vi.fn().mockResolvedValue({}),
    ping: vi.fn().mockResolvedValue('PONG'),
  };
  const publicStorage = {
    presignedGetObject: vi
      .fn()
      .mockImplementation(
        async (_bucket: string, key: string) => `https://files.test/${key}`,
      ),
  };
  const storage = { bucketExists: vi.fn().mockResolvedValue(true) };
  const channel = { close: vi.fn().mockResolvedValue(undefined) };
  const queue = {
    connection: { createChannel: vi.fn().mockResolvedValue(channel) },
    publishChannel: {},
  };

  const ctx = {
    db: {},
    redis,
    storage,
    publicStorage,
    queue,
    bucket: 'test-bucket',
    close: vi.fn(),
  };

  return {
    ctx: ctx as unknown as Context,
    redis,
    storage,
    publicStorage,
    queue,
  };
}

export async function bearer(user: AuthUser) {
  return `Bearer ${await signToken(user)}`;
}
