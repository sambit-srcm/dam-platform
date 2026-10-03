import { assets, createDb, runMigrations, users, type Db } from '@dam/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is required for integration tests');
}

let db: Db;

beforeAll(async () => {
  await runMigrations(url);
  db = createDb(url, { maxConnections: 2 });
});

afterAll(async () => {
  await db.$client.end();
});

function isCheckViolation(error: unknown) {
  const code = (value: unknown) =>
    typeof value === 'object' && value !== null && 'code' in value
      ? (value as { code: unknown }).code
      : undefined;
  return (
    code(error) === '23514' ||
    code((error as { cause?: unknown }).cause) === '23514'
  );
}

describe('database length checks', () => {
  it('stores a user and an asset, and rejects values past the cap', async () => {
    const email = `length-${Date.now()}@example.com`;
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash: 'x'.repeat(60) })
      .returning();

    const [asset] = await db
      .insert(assets)
      .values({
        filename: 'notes.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        ownerId: user!.id,
        storageKey: `documents/${user!.id}`,
        tags: ['notes'],
      })
      .returning();

    expect(asset!.filename).toBe('notes.pdf');

    await expect(
      db.insert(assets).values({
        filename: 'a'.repeat(256),
        mimeType: 'application/pdf',
        sizeBytes: 10,
        ownerId: user!.id,
        storageKey: `documents/${user!.id}-long`,
        tags: ['ok'],
      }),
    ).rejects.toSatisfy(isCheckViolation);

    await expect(
      db.insert(assets).values({
        filename: 'tags.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        ownerId: user!.id,
        storageKey: `documents/${user!.id}-tag`,
        tags: ['this-tag-is-longer-than-thirty-two-chars'],
      }),
    ).rejects.toSatisfy(isCheckViolation);

    await db.delete(assets).where(eq(assets.ownerId, user!.id));
    await db.delete(users).where(eq(users.id, user!.id));
  });
});
