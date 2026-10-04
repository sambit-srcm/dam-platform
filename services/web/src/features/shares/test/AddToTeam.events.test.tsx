/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { change, click, mount } from '../../../test/mount';

const grantTeam = vi.hoisted(() => vi.fn());
vi.mock('../api', () => ({ grantTeam }));

import { AddToTeam } from '../AddToTeam';

const teams = [
  { id: 't1', name: 'Editors' },
  { id: 't2', name: 'Reviewers' },
];

let view: Awaited<ReturnType<typeof mount>>;

beforeEach(() => {
  grantTeam.mockResolvedValue(undefined);
});

afterEach(() => {
  view?.unmount();
});

describe('AddToTeam actions', () => {
  it('grants the first team and shows a confirmation', async () => {
    view = await mount(
      <AddToTeam assetId="a1" filename="beach.jpg" teams={teams} />,
    );
    await click(view.container.querySelector('button')!);
    expect(grantTeam).toHaveBeenCalledWith('a1', 't1');
    expect(view.container.textContent).toContain('Added to Editors');
  });

  it('grants the team chosen from the list', async () => {
    view = await mount(
      <AddToTeam assetId="a1" filename="beach.jpg" teams={teams} />,
    );
    await change(view.container.querySelector('select')!, 't2');
    await click(view.container.querySelector('button')!);
    expect(grantTeam).toHaveBeenCalledWith('a1', 't2');
    expect(view.container.textContent).toContain('Added to Reviewers');
  });

  it('shows the grant error', async () => {
    grantTeam.mockRejectedValueOnce(new Error('already granted'));
    view = await mount(
      <AddToTeam assetId="a1" filename="beach.jpg" teams={teams} />,
    );
    await click(view.container.querySelector('button')!);
    expect(view.container.textContent).toContain('already granted');
  });
});
