/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { change, click, mount, submit } from '../../test/mount';

const api = vi.hoisted(() => ({
  listAllTeams: vi.fn(),
  listMembers: vi.fn(),
  createTeam: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
}));

vi.mock('../../features/teams/api', () => api);

import { AdminTeamsPage } from '../AdminTeamsPage';

let view: Awaited<ReturnType<typeof mount>>;

beforeEach(() => {
  api.listAllTeams.mockResolvedValue([
    { id: 't1', name: 'Editors' },
    { id: 't2', name: 'Reviewers' },
  ]);
  api.listMembers.mockResolvedValue([{ userId: 'u1', email: 'a@b.co' }]);
  api.createTeam.mockResolvedValue({ id: 't3', name: 'Legal' });
  api.addMember.mockResolvedValue({ userId: 'u2', email: 'c@d.co' });
  api.removeMember.mockResolvedValue(undefined);
});

afterEach(() => {
  view?.unmount();
});

describe('AdminTeamsPage', () => {
  it('lists teams and members', async () => {
    view = await mount(<AdminTeamsPage />);
    expect(view.container.textContent).toContain('Editors');
    expect(view.container.textContent).toContain('a@b.co');
  });

  it('says so when there are no teams', async () => {
    api.listAllTeams.mockResolvedValueOnce([]);
    view = await mount(<AdminTeamsPage />);
    expect(view.container.textContent).toContain('No teams yet');
  });

  it('shows a load error', async () => {
    api.listAllTeams.mockRejectedValueOnce(new Error('forbidden'));
    view = await mount(<AdminTeamsPage />);
    expect(view.container.textContent).toContain('forbidden');
  });

  it('creates a team and selects it', async () => {
    api.listAllTeams
      .mockResolvedValueOnce([
        { id: 't1', name: 'Editors' },
        { id: 't2', name: 'Reviewers' },
      ])
      .mockResolvedValueOnce([
        { id: 't1', name: 'Editors' },
        { id: 't3', name: 'Legal' },
      ]);
    api.listMembers.mockResolvedValue([]);
    view = await mount(<AdminTeamsPage />);
    await change(view.container.querySelector('input')!, 'Legal');
    await submit(view.container.querySelector('form')!);
    expect(api.createTeam).toHaveBeenCalledWith('Legal');
    expect(view.container.textContent).toContain('Legal');
  });

  it('reports a create error', async () => {
    api.createTeam.mockRejectedValueOnce(new Error('name taken'));
    view = await mount(<AdminTeamsPage />);
    await change(view.container.querySelector('input')!, 'Editors');
    await submit(view.container.querySelector('form')!);
    expect(view.container.textContent).toContain('name taken');
  });

  it('switches team, adds a member, and removes one', async () => {
    view = await mount(<AdminTeamsPage />);
    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Reviewers',
      )!,
    );
    expect(api.listMembers).toHaveBeenCalledWith('t2');

    const email = view.container.querySelector('input[type="email"]')!;
    await change(email, 'c@d.co');
    const forms = view.container.querySelectorAll('form');
    await submit(forms[1]!);
    expect(api.addMember).toHaveBeenCalledWith('t2', 'c@d.co');

    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Remove',
      )!,
    );
    expect(api.removeMember).toHaveBeenCalledWith('t2', 'u1');
  });

  it('reports member errors', async () => {
    api.addMember.mockRejectedValueOnce(new Error('unknown email'));
    api.removeMember.mockRejectedValueOnce(new Error('cannot remove'));
    api.listMembers.mockRejectedValueOnce(new Error('members failed'));
    view = await mount(<AdminTeamsPage />);
    expect(view.container.textContent).toContain('members failed');

    api.listMembers.mockResolvedValue([{ userId: 'u1', email: 'a@b.co' }]);
    view.unmount();
    view = await mount(<AdminTeamsPage />);
    await change(view.container.querySelector('input[type="email"]')!, 'x@y.z');
    await submit(view.container.querySelectorAll('form')[1]!);
    expect(view.container.textContent).toContain('unknown email');
    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Remove',
      )!,
    );
    expect(view.container.textContent).toContain('cannot remove');
  });
});
