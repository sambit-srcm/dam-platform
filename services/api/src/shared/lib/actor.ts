import type { Asset, UserRole } from '@dam/db';

// Who is making the request, taken from a verified token
export type AuthUser = { id: string; role: UserRole };

// Users and admins get the same access for now: only their own assets.
// Admin-wide access will live in a separate admin API.
export function canAccess(actor: AuthUser, asset: Pick<Asset, 'ownerId'>) {
  return asset.ownerId === actor.id;
}
