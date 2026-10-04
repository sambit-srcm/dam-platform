import { http } from '../../lib/http';

export type Team = {
  id: string;
  name: string;
  createdAt?: string;
};

export type TeamMember = {
  userId: string;
  email: string;
};

export async function listTeams(): Promise<Team[]> {
  const res = await http.get<{ items: Team[] }>('/teams');
  return res.data.items;
}

export async function listAllTeams(): Promise<Team[]> {
  const res = await http.get<{ items: Team[] }>('/admin/teams');
  return res.data.items;
}

export async function createTeam(name: string): Promise<Team> {
  const res = await http.post<Team>('/admin/teams', { name });
  return res.data;
}

export async function listMembers(teamId: string): Promise<TeamMember[]> {
  const res = await http.get<{ items: TeamMember[] }>(
    `/admin/teams/${teamId}/members`,
  );
  return res.data.items;
}

export async function addMember(
  teamId: string,
  email: string,
): Promise<TeamMember> {
  const res = await http.post<TeamMember>(`/admin/teams/${teamId}/members`, {
    email,
  });
  return res.data;
}

export async function removeMember(
  teamId: string,
  userId: string,
): Promise<void> {
  await http.delete(`/admin/teams/${teamId}/members/${userId}`);
}
