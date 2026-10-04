import { beforeEach, describe, expect, it } from 'vitest';
import { http } from '../../../lib/http';
import {
  addMember,
  createTeam,
  listAllTeams,
  listMembers,
  listTeams,
  removeMember,
} from '../api';

let sent: { method: string; url: string; data?: unknown }[] = [];
let next: unknown = {};

beforeEach(() => {
  sent = [];
  next = {};
  http.defaults.adapter = async (config) => {
    sent.push({
      method: (config.method ?? '').toUpperCase(),
      url: config.url ?? '',
      data: config.data === undefined ? undefined : JSON.parse(config.data),
    });
    return { data: next, status: 200, statusText: 'OK', headers: {}, config };
  };
});

const team = { id: 't1', name: 'Editors' };
const member = { userId: 'u1', email: 'a@b.co' };

describe('team API calls', () => {
  it('loads the teams the caller belongs to', async () => {
    next = { items: [team] };
    await expect(listTeams()).resolves.toEqual([team]);
    expect(sent[0]).toMatchObject({ method: 'GET', url: '/teams' });
  });

  it('loads every team for an admin', async () => {
    next = { items: [team] };
    await expect(listAllTeams()).resolves.toEqual([team]);
    expect(sent[0]).toMatchObject({ method: 'GET', url: '/admin/teams' });
  });

  it('creates a team', async () => {
    next = team;
    await expect(createTeam('Editors')).resolves.toEqual(team);
    expect(sent[0]).toEqual({
      method: 'POST',
      url: '/admin/teams',
      data: { name: 'Editors' },
    });
  });

  it('loads, adds, and removes members', async () => {
    next = { items: [member] };
    await expect(listMembers('t1')).resolves.toEqual([member]);

    next = member;
    await expect(addMember('t1', 'a@b.co')).resolves.toEqual(member);
    expect(sent[1]).toEqual({
      method: 'POST',
      url: '/admin/teams/t1/members',
      data: { email: 'a@b.co' },
    });

    await removeMember('t1', 'u1');
    expect(sent[2]).toMatchObject({
      method: 'DELETE',
      url: '/admin/teams/t1/members/u1',
    });
  });
});
