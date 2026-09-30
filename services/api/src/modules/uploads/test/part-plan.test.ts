import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../shared/errors/AppError.ts';
import { planParts } from '../utils/part-plan.ts';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

describe('cutting a file into upload parts', () => {
  it('sends a small file in one piece', () => {
    expect(planParts(2 * MIB)).toEqual({ partSize: 2 * MIB, partCount: 1 });
  });

  it('sends a file of exactly 5 MB in one piece', () => {
    expect(planParts(5 * MIB)).toEqual({ partSize: 5 * MIB, partCount: 1 });
  });

  it('uses 5 MB parts for a medium file', () => {
    expect(planParts(50 * MIB)).toEqual({ partSize: 5 * MIB, partCount: 10 });
  });

  it('counts the leftover bytes as one more part', () => {
    expect(planParts(12 * MIB)).toEqual({ partSize: 5 * MIB, partCount: 3 });
  });

  it('keeps 5 MB parts all the way up to the biggest allowed file', () => {
    const { partSize, partCount } = planParts(5 * GIB);
    expect(partSize).toBe(5 * MIB);
    expect(partCount).toBe(1024);
    expect(partCount).toBeLessThanOrEqual(10_000);
  });

  it('always covers the whole file', () => {
    for (const size of [1, 5 * MIB + 1, 123 * MIB + 7, 4 * GIB + 3]) {
      const { partSize, partCount } = planParts(size);
      expect(partSize * partCount).toBeGreaterThanOrEqual(size);
      expect(partSize * (partCount - 1)).toBeLessThan(size);
    }
  });

  it.each([0, -5, 1.5, Number.NaN])('refuses a size of %s', (size) => {
    expect(() => planParts(size)).toThrow(ValidationError);
  });

  it('refuses a file over the 5 GB limit', () => {
    expect(() => planParts(5 * GIB + 1)).toThrow(/larger than 5 GB/);
  });
});
