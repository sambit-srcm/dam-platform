import { sql } from 'drizzle-orm';
import { assets } from './schema.ts';

// For an update: keeps the tags the asset has and adds these, without repeats
export function mergeTags(tags: string[]) {
  const added = sql`array[${sql.join(
    tags.map((tag) => sql`${tag}`),
    sql`, `,
  )}]::text[]`;

  return sql`array(select distinct tag from unnest(${assets.tags} || ${added}) as tag order by tag)`;
}
