import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from './types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setSession: (data: { accessToken: string; refreshToken: string; user: User }) => void;
  setTokens: (data: { accessToken: string; refreshToken: string }) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),
      setTokens: ({ accessToken, refreshToken }) =>
        set({ accessToken, refreshToken }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'tower.auth' },
  ),
);
