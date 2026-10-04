import { assetTeamGrants, teamMembers, teams, users, type Db } from '@dam/db';
import { and, asc, eq } from 'drizzle-orm';

export async function insertTeam(db: Db, values: { name: string }) {
  const [team] = await db.insert(teams).values(values).returning();
  return team!;
}

export async function listTeams(db: Db) {
  return db
    .select({
      id: teams.id,
      name: teams.name,
      createdAt: teams.createdAt,
    })
    .from(teams)
    .orderBy(asc(teams.name));
}

export async function findTeamById(db: Db, teamId: string) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  return team;
}

export async function listTeamsForUser(db: Db, userId: string) {
  return db
    .select({
      id: teams.id,
      name: teams.name,
      createdAt: teams.createdAt,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId))
    .orderBy(asc(teams.name));
}

export async function findMembership(db: Db, teamId: string, userId: string) {
  const [row] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  return row;
}

export async function listMembers(db: Db, teamId: string) {
  return db
    .select({
      userId: users.id,
      email: users.email,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId));
}

export async function addMember(
  db: Db,
  values: { teamId: string; userId: string },
) {
  await db.insert(teamMembers).values(values);
}

export async function removeMember(db: Db, teamId: string, userId: string) {
  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
}

export async function hasTeamAccess(db: Db, assetId: string, userId: string) {
  const [row] = await db
    .select({ assetId: assetTeamGrants.assetId })
    .from(assetTeamGrants)
    .innerJoin(teamMembers, eq(teamMembers.teamId, assetTeamGrants.teamId))
    .where(
      and(eq(assetTeamGrants.assetId, assetId), eq(teamMembers.userId, userId)),
    )
    .limit(1);
  return Boolean(row);
}

export async function grantTeam(
  db: Db,
  values: { assetId: string; teamId: string; grantedBy: string },
) {
  await db.insert(assetTeamGrants).values(values).onConflictDoNothing();
}

export async function revokeTeam(db: Db, assetId: string, teamId: string) {
  await db
    .delete(assetTeamGrants)
    .where(
      and(
        eq(assetTeamGrants.assetId, assetId),
        eq(assetTeamGrants.teamId, teamId),
      ),
    );
}

export async function listGrants(db: Db, assetId: string) {
  return db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      createdAt: assetTeamGrants.createdAt,
    })
    .from(assetTeamGrants)
    .innerJoin(teams, eq(teams.id, assetTeamGrants.teamId))
    .where(eq(assetTeamGrants.assetId, assetId));
}
