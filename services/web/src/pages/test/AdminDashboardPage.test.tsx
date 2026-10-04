/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { change, mount } from '../../test/mount';

const getDashboard = vi.hoisted(() => vi.fn());
vi.mock('../../features/admin/api', () => ({ getDashboard }));

import { AdminDashboardPage } from '../AdminDashboardPage';

const data = {
  totals: { assets: 2, storageBytes: 1000, downloads: 3, users: 1 },
  byStatus: { ready: 2 },
  byType: { image: 2 },
  days: [{ day: '2026-09-28', uploads: 1, downloads: 2 }],
  latest: [],
  topDownloaded: [],
};

let view: Awaited<ReturnType<typeof mount>>;

beforeEach(() => {
  getDashboard.mockResolvedValue(data);
});

afterEach(() => {
  view?.unmount();
});

describe('AdminDashboardPage', () => {
  it('loads the dashboard and changes the range', async () => {
    view = await mount(<AdminDashboardPage />);
    expect(view.container.textContent).toContain('Users');
    expect(getDashboard).toHaveBeenCalledWith(14);
    await change(view.container.querySelector('select')!, '30');
    expect(getDashboard).toHaveBeenCalledWith(30);
  });

  it('shows a load error', async () => {
    getDashboard.mockRejectedValueOnce(new Error('forbidden'));
    view = await mount(<AdminDashboardPage />);
    expect(view.container.textContent).toContain('forbidden');
  });
});
