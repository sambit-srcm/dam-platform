import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Dashboard } from '../../features/admin/types';
import { DashboardView } from '../AdminDashboardPage';

const data = (overrides: Partial<Dashboard> = {}): Dashboard => ({
  totals: {
    assets: 12,
    storageBytes: 3 * 1024 * 1024,
    downloads: 40,
    users: 5,
  },
  byStatus: { ready: 10, failed: 2 },
  byType: { image: 8, video: 4 },
  days: [
    { day: '2026-09-27', uploads: 1, downloads: 2 },
    { day: '2026-09-28', uploads: 4, downloads: 8 },
    { day: '2026-09-29', uploads: 0, downloads: 0 },
  ],
  latest: [
    {
      id: 'a1',
      filename: 'new-photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      status: 'ready',
      tags: [],
      createdAt: '2026-09-28T08:30:00.000Z',
      thumbnailUrl: 'https://files.test/t.webp',
      ownerId: 'u1',
      ownerEmail: 'alice@example.com',
      downloadCount: 0,
    },
  ],
  topDownloaded: [
    {
      id: 'a2',
      filename: 'popular.mp4',
      mimeType: 'video/mp4',
      downloadCount: 99,
      ownerEmail: null,
      thumbnailUrl: null,
    },
  ],
  ...overrides,
});

const show = (value: Dashboard, days = 14) =>
  renderToStaticMarkup(
    <DashboardView data={value} days={days} onDaysChange={() => {}} />,
  );

describe('admin dashboard', () => {
  it('shows the four headline numbers', () => {
    const html = show(data());
    expect(html).toContain('Users');
    expect(html).toContain('>5<');
    expect(html).toContain('>12<');
    expect(html).toContain('3.0 MB');
    expect(html).toContain('>40<');
  });

  it('offers 7, 14, 30 and 90 days and selects the current one', () => {
    const html = show(data(), 30);
    for (const range of ['7 days', '14 days', '30 days', '90 days']) {
      expect(html).toContain(range);
    }
    expect(html).toMatch(/<option value="30" selected="">30 days/);
  });

  it('draws a bar for each day, tallest for the busiest', () => {
    const html = show(data());
    expect(html).toContain('title="2026-09-28: 4"');
    expect(html).toContain('height:100%');
    expect(html).toContain('height:25%');
  });

  it('shows the first and last day under each chart', () => {
    const html = show(data());
    expect(html).toContain('>2026-09-27<');
    expect(html).toContain('>2026-09-29<');
  });

  it('says downloads are unavailable when the counts could not be read', () => {
    const html = show(
      data({
        days: [
          { day: '2026-09-27', uploads: 1, downloads: null },
          { day: '2026-09-28', uploads: 2, downloads: null },
        ],
      }),
    );
    expect(html).toContain('Unavailable');
  });

  it('does not crash on an empty range of days', () => {
    expect(() => show(data({ days: [] }))).not.toThrow();
  });

  it('breaks assets down by type and status', () => {
    const html = show(data());
    expect(html).toContain('By type');
    expect(html).toContain('By status');
    expect(html).toContain('>image<');
    expect(html).toContain('>failed<');
  });

  it('says "Nothing yet" for an empty breakdown', () => {
    expect(show(data({ byType: {}, byStatus: {} }))).toContain('Nothing yet');
  });

  it('lists the latest uploads with owner and date', () => {
    const html = show(data());
    expect(html).toContain('Latest uploads');
    expect(html).toContain('new-photo.jpg');
    expect(html).toContain('alice@example.com');
    expect(html).toContain('https://files.test/t.webp');
  });

  it('lists the most downloaded with their download count and "No owner"', () => {
    const html = show(data());
    expect(html).toContain('Most downloaded');
    expect(html).toContain('popular.mp4');
    expect(html).toContain('>99<');
    expect(html).toContain('No owner');
  });

  it('has friendly messages for empty lists', () => {
    const html = show(data({ latest: [], topDownloaded: [] }));
    expect(html).toContain('Nothing uploaded yet');
    expect(html).toContain('No downloads yet');
  });
});
