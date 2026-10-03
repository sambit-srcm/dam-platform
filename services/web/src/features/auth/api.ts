import { http } from '../../lib/http';
import type { AuthResponse, AuthUser, Credentials } from './types';

export async function login(credentials: Credentials) {
  const res = await http.post<AuthResponse>('/auth/login', credentials);
  return res.data;
}

export async function register(credentials: Credentials) {
  const res = await http.post<AuthResponse>('/auth/register', credentials);
  return res.data;
}

export async function getMe() {
  const res = await http.get<AuthUser>('/auth/me');
  return res.data;
}

export async function logout() {
  await http.post('/auth/logout');
}
