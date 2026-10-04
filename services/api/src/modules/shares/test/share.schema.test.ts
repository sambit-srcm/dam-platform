import { describe, expect, it } from 'vitest';
import { createShareBody } from '../share.schema.ts';
import { hashShareToken, newShareToken } from '../token.ts';

describe('share tokens', () => {
  it('stores a hash, not the token', () => {
    const token = newShareToken();
    const hash = hashShareToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
  });
});

describe('share expiry', () => {
  it('rejects a date more than 30 days away', () => {
    const tooFar = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(createShareBody.safeParse({ expiresAt: tooFar }).success).toBe(
      false,
    );
  });

  it('accepts a date tomorrow', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(createShareBody.safeParse({ expiresAt: tomorrow }).success).toBe(
      true,
    );
  });
});
