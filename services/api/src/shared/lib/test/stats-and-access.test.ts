import { describe, expect, it } from 'vitest';
import { alice, bob, admin } from '../../../test/helpers.ts';
import { canAccess } from '../actor.ts';
import { downloadsDaykey, STATS_RETENTION_SECONDS } from '../stats.ts';

describe('the daily download counter name', () => {
  it('is based on the calendar day', () => {
    expect(downloadsDaykey(new Date('2026-09-29T10:00:00Z'))).toBe(
      'stats:downloads:2026-09-29',
    );
  });

  it('uses the UTC day, whatever the time of day', () => {
    expect(downloadsDaykey(new Date('2026-09-29T00:00:00Z'))).toBe(
      downloadsDaykey(new Date('2026-09-29T23:59:59Z')),
    );
  });

  it('is kept for 90 days', () => {
    expect(STATS_RETENTION_SECONDS).toBe(90 * 24 * 60 * 60);
  });
});

describe('who may open an asset', () => {
  it('lets the owner in', () => {
    expect(canAccess(alice, { ownerId: alice.id })).toBe(true);
  });

  it('keeps other people out', () => {
    expect(canAccess(bob, { ownerId: alice.id })).toBe(false);
  });

  it('does not give admins a shortcut here, they have their own area', () => {
    expect(canAccess(admin, { ownerId: alice.id })).toBe(false);
  });

  it('keeps everybody out of assets that have no owner', () => {
    expect(canAccess(alice, { ownerId: null })).toBe(false);
  });
});
