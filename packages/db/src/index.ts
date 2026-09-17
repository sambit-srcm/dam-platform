import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';

export function createDb(connectionString: string) {
  return drizzle({
    connection: { connectionString },
    schema,
    casing: 'snake_case',
  });
}

export type Db = ReturnType<typeof createDb>;

// Smallest possible query, used by health checks to prove the database answers
export async function pingDb(db: Db) {
  await db.execute(sql`select 1`);
}

export * from './queries.ts';
export * from './schema.ts';
