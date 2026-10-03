import { create } from 'zustand';
import type { AuthUser } from './types';

type AuthState = {
  user: AuthUser | null;
  // False until the first /auth/me check finishes, so a refresh does not flash the login page
  ready: boolean;
  setUser: (user: AuthUser | null) => void;
  clearUser: () => void;
};

// The session token lives in an HttpOnly cookie, so this store only remembers who is signed in.
// Drop any token left behind by the previous localStorage session.
localStorage.removeItem('dam-auth');

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user, ready: true }),
  clearUser: () => set({ user: null, ready: true }),
}));
