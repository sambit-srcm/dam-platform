import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';

export function createDb(
  connectionString: string,
  options?: { maxConnections?: number },
) {
  return drizzle({
    connection: { connectionString, max: options?.maxConnections },
    schema,
    casing: 'snake_case',
  });
}

export type Db = ReturnType<typeof createDb>;

// Smallest possible query, used by health checks to prove the database answers
export async function pingDb(db: Db) {
  await db.execute(sql`select 1`);
}

export * from './constants.ts';
export * from './schema.ts';
export * from './tags.ts';
