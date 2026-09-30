import { describe, expect, it } from 'vitest';
import { CLEARED_FILTERS, toggleTag } from '../filterActions';

describe('tag picking', () => {
  it('adds a tag that is not chosen yet', () => {
    expect(toggleTag(undefined, 'sea')).toEqual(['sea']);
    expect(toggleTag(['sea'], 'sand')).toEqual(['sea', 'sand']);
  });

  it('removes a tag that is already chosen', () => {
    expect(toggleTag(['sea', 'sand'], 'sea')).toEqual(['sand']);
  });

  it('drops the tag filter when the last tag is removed', () => {
    expect(toggleTag(['sea'], 'sea')).toBeUndefined();
  });

  it('clears every filter but keeps the sort', () => {
    expect(Object.keys(CLEARED_FILTERS).sort()).toEqual([
      'from',
      'q',
      'status',
      'tags',
      'to',
      'type',
    ]);
    expect(Object.values(CLEARED_FILTERS).every((v) => v === undefined)).toBe(
      true,
    );
  });
});
