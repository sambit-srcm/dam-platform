import { findUserByEmail } from '../auth/auth.repository.ts';
import { findAssetById } from '../assets/asset.repository.ts';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/AppError.ts';
import { canAccess, type AuthUser } from '../../shared/lib/actor.ts';
import type { Context } from '../../shared/lib/context.ts';
import {
  addMember,
  findMembership,
  findTeamById,
  grantTeam,
  insertTeam,
  listGrants,
  listMembers,
  listTeams,
  listTeamsForUser,
  removeMember,
  revokeTeam,
} from './team.repository.ts';

function requireAdmin(actor: AuthUser) {
  if (actor.role !== 'admin') {
    throw new ForbiddenError('Only an admin can do that');
  }
}

async function requireTeam(ctx: Context, teamId: string) {
  const team = await findTeamById(ctx.db, teamId);
  if (!team) throw new NotFoundError('Team not found');
  return team;
}

export async function createTeam(
  ctx: Context,
  actor: AuthUser,
  input: { name: string },
) {
  requireAdmin(actor);
  const team = await insertTeam(ctx.db, { name: input.name });
  return { id: team.id, name: team.name };
}

export async function listAllTeams(ctx: Context, actor: AuthUser) {
  requireAdmin(actor);
  return listTeams(ctx.db);
}

export async function listMyTeams(ctx: Context, actor: AuthUser) {
  return listTeamsForUser(ctx.db, actor.id);
}

export async function listTeamMembers(
  ctx: Context,
  actor: AuthUser,
  teamId: string,
) {
  requireAdmin(actor);
  await requireTeam(ctx, teamId);
  return listMembers(ctx.db, teamId);
}

export async function inviteMember(
  ctx: Context,
  actor: AuthUser,
  teamId: string,
  email: string,
) {
  requireAdmin(actor);
  await requireTeam(ctx, teamId);
  const user = await findUserByEmail(ctx.db, email);
  if (!user) throw new NotFoundError('No account with that email');
  const existing = await findMembership(ctx.db, teamId, user.id);
  if (existing) throw new ConflictError('That person is already on the team');
  await addMember(ctx.db, { teamId, userId: user.id });
  return { userId: user.id, email: user.email };
}

export async function dropMember(
  ctx: Context,
  actor: AuthUser,
  teamId: string,
  userId: string,
) {
  requireAdmin(actor);
  await requireTeam(ctx, teamId);
  const existing = await findMembership(ctx.db, teamId, userId);
  if (!existing) throw new NotFoundError('That person is not on the team');
  await removeMember(ctx.db, teamId, userId);
}

async function requireAssetOwner(
  ctx: Context,
  assetId: string,
  actor: AuthUser,
) {
  const asset = await findAssetById(ctx.db, assetId);
  if (!asset || !canAccess(actor, asset))
    throw new NotFoundError('Asset not found');
  return asset;
}

export async function shareAssetWithTeam(
  ctx: Context,
  actor: AuthUser,
  assetId: string,
  teamId: string,
) {
  await requireAssetOwner(ctx, assetId, actor);
  const membership = await findMembership(ctx.db, teamId, actor.id);
  if (!membership) throw new NotFoundError('Team not found');
  await grantTeam(ctx.db, { assetId, teamId, grantedBy: actor.id });
}

export async function unshareAssetWithTeam(
  ctx: Context,
  actor: AuthUser,
  assetId: string,
  teamId: string,
) {
  await requireAssetOwner(ctx, assetId, actor);
  await revokeTeam(ctx.db, assetId, teamId);
}

export async function listAssetTeams(
  ctx: Context,
  actor: AuthUser,
  assetId: string,
) {
  await requireAssetOwner(ctx, assetId, actor);
  return listGrants(ctx.db, assetId);
}
