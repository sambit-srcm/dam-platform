import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { assetOrder, assetWhere } from '../asset.filters.ts';

const dialect = new PgDialect();
const render = (filters: Parameters<typeof assetWhere>[0]) => {
  const where = assetWhere(filters);
  return where ? dialect.sqlToQuery(where) : null;
};

describe('building the search behind the gallery', () => {
  it('adds no conditions when nothing is asked for', () => {
    expect(render({})).toBeNull();
  });
  it('also matches a tag with exactly that name', () => {
    const query = render({ q: 'Sun' })!;
    expect(query.sql).toContain('@>');
    expect(query.params).toContain('{"sun"}');
  });
});

describe('ordering the gallery', () => {
  it('puts the newest first and breaks ties by id so pages never repeat', () => {
    const parts = assetOrder('createdAt').map((o) => dialect.sqlToQuery(o).sql);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('createdAt');
    expect(parts[1]).toContain('"id"');
  });
});
