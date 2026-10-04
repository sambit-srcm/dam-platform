import { beforeEach, describe, expect, it, vi } from 'vitest';
import { admin, alice, makeCtx } from '../../../test/helpers.ts';

vi.mock('../team.repository.ts', () => ({
  insertTeam: vi.fn(),
  findTeamById: vi.fn(),
  findMembership: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
}));

vi.mock('../../auth/auth.repository.ts', () => ({
  findUserByEmail: vi.fn(),
}));

import { findUserByEmail } from '../../auth/auth.repository.ts';
import {
  findMembership,
  findTeamById,
  insertTeam,
} from '../team.repository.ts';
import { createTeam, dropMember, inviteMember } from '../team.service.ts';

const TEAM_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

const team = {
  id: TEAM_ID,
  name: 'Editors',
  createdAt: new Date(),
};

let ctx: ReturnType<typeof makeCtx>['ctx'];

beforeEach(() => {
  vi.resetAllMocks();
  ctx = makeCtx().ctx;
});

describe('creating a team', () => {
  it('refuses someone who is not an admin', async () => {
    await expect(
      createTeam(ctx, alice, { name: 'Editors' }),
    ).rejects.toMatchObject({
      status: 403,
    });
    expect(insertTeam).not.toHaveBeenCalled();
  });

  it('lets an admin create a team without joining it', async () => {
    vi.mocked(insertTeam).mockResolvedValue(team);

    await expect(createTeam(ctx, admin, { name: 'Editors' })).resolves.toEqual({
      id: TEAM_ID,
      name: 'Editors',
    });
    expect(insertTeam).toHaveBeenCalledWith(ctx.db, { name: 'Editors' });
  });
});

describe('adding a member', () => {
  it('refuses someone who is not an admin', async () => {
    await expect(
      inviteMember(ctx, alice, TEAM_ID, 'bob@example.com'),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('says not found when the email has no account', async () => {
    vi.mocked(findTeamById).mockResolvedValue(team);
    vi.mocked(findUserByEmail).mockResolvedValue(undefined as never);

    await expect(
      inviteMember(ctx, admin, TEAM_ID, 'missing@example.com'),
    ).rejects.toMatchObject({
      status: 404,
      message: 'No account with that email',
    });
  });
});

describe('removing a member', () => {
  it('refuses someone who is not an admin', async () => {
    await expect(
      dropMember(ctx, alice, TEAM_ID, OTHER_ID),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it('removes a member when an admin asks', async () => {
    vi.mocked(findTeamById).mockResolvedValue(team);
    vi.mocked(findMembership).mockResolvedValue({
      teamId: TEAM_ID,
      userId: OTHER_ID,
      createdAt: new Date(),
    });

    await expect(
      dropMember(ctx, admin, TEAM_ID, OTHER_ID),
    ).resolves.toBeUndefined();
  });
});
