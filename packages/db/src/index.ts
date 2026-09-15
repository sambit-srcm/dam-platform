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

export * from './schema.ts';
