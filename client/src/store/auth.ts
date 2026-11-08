import { create } from "zustand";
import type { User } from "../types";

/**
 * The access token lives only in memory (not localStorage), so injected scripts can't read it from storage.
 * A page reload loses it; we get a new one from the httpOnly refresh cookie (see useBootstrapAuth).
 */
interface AuthState {
  accessToken: string | null;
  user: User | null;
  /** false until we've tried to restore the session on page load */
  ready: boolean;
  setSession: (accessToken: string, user: User) => void;
  clearSession: () => void;
  setReady: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  ready: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clearSession: () => set({ accessToken: null, user: null }),
  setReady: () => set({ ready: true }),
}));
