import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';

// Idle clients are released after 30s. A query that runs longer than 15s is cancelled.
// Migrations leave these unset so a slow migration is not cut off.
export const DB_POOL_LIMITS = {
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statementTimeoutMillis: 15_000,
} as const;

export function createDb(
  connectionString: string,
  options?: {
    maxConnections?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    statementTimeoutMillis?: number;
  },
) {
  return drizzle({
    connection: {
      connectionString,
      max: options?.maxConnections,
      idleTimeoutMillis: options?.idleTimeoutMillis,
      connectionTimeoutMillis: options?.connectionTimeoutMillis,
      statement_timeout: options?.statementTimeoutMillis,
    },
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
export * from './migrate.ts';
export * from './schema.ts';
export * from './tags.ts';
