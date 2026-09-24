import { users, type Db, type NewUser } from '@dam/db';
import { eq } from 'drizzle-orm';

export async function createUser(
  db: Db,
  values: Pick<NewUser, 'email' | 'passwordHash'>,
) {
  const [user] = await db.insert(users).values(values).returning();
  return user!;
}

export async function findUserByEmail(db: Db, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

export async function findUserById(db: Db, id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}
