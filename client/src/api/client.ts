import { useAuthStore } from "../store/auth";
import type { User } from "../types";

export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface SessionResponse {
  accessToken: string;
  user: User;
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Gets a new access token from the refresh cookie.
 * Single-flight: if 3 requests get 401 at once, they all wait for ONE refresh call.
 */
export function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        useAuthStore.getState().clearSession();
        return null;
      }
      const data = (await res.json()) as SessionResponse;
      useAuthStore.getState().setSession(data.accessToken, data.user);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * fetch() wrapper: adds the access token, and on 401 refreshes it once and retries.
 * Returns the raw Response so callers can read JSON or a stream.
 */
export async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });

  if (res.status === 401 && retry && !path.startsWith("/api/auth/")) {
    const newToken = await refreshAccessToken();
    if (newToken) return apiFetch(path, init, false);
  }
  return res;
}

async function errorFrom(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // not JSON
  }
  return new ApiError(res.status, message);
}

/** apiFetch + JSON + throw ApiError on non-2xx. */
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) throw await errorFrom(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export { errorFrom };
