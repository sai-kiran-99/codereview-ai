import { useAuthStore } from "../store/auth";
import { apiJson } from "./client";
import type { User } from "../types";

interface SessionResponse {
  accessToken: string;
  user: User;
}

async function startSession(path: "signup" | "login", email: string, password: string) {
  const data = await apiJson<SessionResponse>(`/api/auth/${path}`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  useAuthStore.getState().setSession(data.accessToken, data.user);
  return data.user;
}

export const signup = (email: string, password: string) => startSession("signup", email, password);
export const login = (email: string, password: string) => startSession("login", email, password);

export async function logout() {
  try {
    await apiJson<void>("/api/auth/logout", { method: "POST" });
  } finally {
    useAuthStore.getState().clearSession();
  }
}
