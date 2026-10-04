import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCtx } from '../../../test/helpers.ts';

vi.mock('../share.repository.ts', () => ({
  findActiveShare: vi.fn(),
}));

import { findActiveShare } from '../share.repository.ts';
import { previewShare } from '../share.service.ts';

let ctx: ReturnType<typeof makeCtx>['ctx'];

beforeEach(() => {
  vi.resetAllMocks();
  ctx = makeCtx().ctx;
});

describe('opening a share', () => {
  it('hides a missing, expired or revoked link', async () => {
    vi.mocked(findActiveShare).mockResolvedValue(undefined);
    await expect(previewShare(ctx, 'a'.repeat(32))).rejects.toMatchObject({
      status: 404,
    });
  });
});
