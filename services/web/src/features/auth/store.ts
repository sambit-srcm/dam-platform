import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, AuthUser } from './types';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  setSession: (session: AuthResponse) => void;
  logout: () => void;
};

// Kept in localStorage so a refresh doesn't sign the user out
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: ({ token, user }) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'dam-auth' },
  ),
);
