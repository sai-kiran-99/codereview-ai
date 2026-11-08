import jwt from "jsonwebtoken";
import type { CookieOptions } from "express";
import { env, isProd } from "../config.js";

export const ACCESS_TTL = "15m";
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
export const REFRESH_COOKIE = "refreshToken";

interface AccessPayload { sub: string }
interface RefreshPayload { sub: string; ver: number }

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies AccessPayload, env("JWT_ACCESS_SECRET"), { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ sub: userId, ver: tokenVersion } satisfies RefreshPayload, env("JWT_REFRESH_SECRET"), {
    expiresIn: REFRESH_TTL_SECONDS,
  });
}

/** Throws if the token is invalid or expired. */
export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env("JWT_ACCESS_SECRET")) as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env("JWT_REFRESH_SECRET")) as RefreshPayload;
}

/**
 * httpOnly: JavaScript can't read it (XSS can't steal it).
 * path: only sent to /api/auth, not with every API call.
 * sameSite "none" + secure in production because client (Vercel) and API (Render) are on different domains.
 */
export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: isProd() ? "none" : "lax",
    path: "/api/auth",
    maxAge: REFRESH_TTL_SECONDS * 1000,
  };
}
