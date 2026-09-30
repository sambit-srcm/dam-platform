import { describe, expect, it } from 'vitest';
import { formatDate, formatSize } from '../format';

describe('formatSize', () => {
  it('shows small files in KB', () => {
    expect(formatSize(2048)).toBe('2 KB');
  });

  it('shows an empty file as 0 KB', () => {
    expect(formatSize(0)).toBe('0 KB');
  });

  it('shows medium files in MB with one decimal', () => {
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });

  it('switches to MB right at one megabyte', () => {
    expect(formatSize(1024 * 1024 - 1)).toBe('1024 KB');
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('shows big files in GB with two decimals', () => {
    expect(formatSize(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
    expect(formatSize(5 * 1024 * 1024 * 1024)).toBe('5.00 GB');
  });
});

describe('formatDate', () => {
  it('shows the same moment the browser would show', () => {
    const iso = '2026-09-28T08:30:00.000Z';
    expect(formatDate(iso)).toBe(new Date(iso).toLocaleString());
  });

  it('includes the year and the time, not just the day', () => {
    const text = formatDate('2026-09-28T08:30:00.000Z');
    expect(text).toContain('2026');
    expect(text).toMatch(/\d:\d\d/);
  });
});
