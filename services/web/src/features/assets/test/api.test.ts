import { describe, expect, it } from 'vitest';
import { toQuery } from '../api';

describe('toQuery (turning the filters into what the API expects)', () => {
  it('joins several tags into one comma separated value', () => {
    expect(toQuery({ tags: ['beach', 'sunset'] }).tags).toBe('beach,sunset');
  });

  it('leaves out the tags when none are chosen', () => {
    expect(toQuery({ tags: [] }).tags).toBeUndefined();
    expect(toQuery({}).tags).toBeUndefined();
  });

  it('leaves out an empty search text', () => {
    expect(toQuery({ q: '' }).q).toBeUndefined();
  });

  it('keeps a real search text', () => {
    expect(toQuery({ q: 'holiday' }).q).toBe('holiday');
  });

  it('passes every other filter through untouched', () => {
    const query = toQuery({
      type: 'video',
      status: 'ready',
      sort: 'createdAt',
      limit: 24,
      offset: 48,
    });
    expect(query).toMatchObject({
      type: 'video',
      status: 'ready',
      sort: 'createdAt',
      limit: 24,
      offset: 48,
    });
  });
});
