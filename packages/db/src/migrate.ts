import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './index.ts';

// Any fixed number works; it only has to match between replicas
const MIGRATION_LOCK_ID = 7_310_422;

const migrationsFolder = fileURLToPath(
  new URL('../migrations', import.meta.url),
);

// Applies migrations that haven't run yet. Replicas starting together wait on the
// lock, so only one applies them and the rest find nothing left to do.
export async function runMigrations(connectionString: string) {
  // One connection, so the lock and the migrations share a session
  const db = createDb(connectionString, { maxConnections: 1 });

  try {
    await db.execute(sql`select pg_advisory_lock(${MIGRATION_LOCK_ID})`);
    try {
      await migrate(db, { migrationsFolder });
    } finally {
      await db.execute(sql`select pg_advisory_unlock(${MIGRATION_LOCK_ID})`);
    }
  } finally {
    await db.$client.end();
  }
}
