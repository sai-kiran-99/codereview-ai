import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { HttpError } from "../middleware/errorHandler.js";
import {
  REFRESH_COOKIE,
  refreshCookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens.js";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("must be a valid email")),
  // bcrypt only uses the first 72 bytes, so cap it.
  password: z.string().min(8, "must be at least 8 characters").max(72, "must be at most 72 characters"),
});
type Credentials = z.infer<typeof credentialsSchema>;

const BCRYPT_ROUNDS = 10;

/** Sets the refresh cookie and returns the access token + public user. */
function issueTokens(res: Response, user: { _id: unknown; email: string; tokenVersion: number }) {
  const userId = String(user._id);
  res.cookie(REFRESH_COOKIE, signRefreshToken(userId, user.tokenVersion), refreshCookieOptions());
  return { accessToken: signAccessToken(userId), user: { id: userId, email: user.email } };
}

export async function signup(req: Request, res: Response) {
  const { email, password } = req.body as Credentials;

  if (await User.exists({ email })) throw new HttpError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const user = await User.create({ email, passwordHash });
    res.status(201).json(issueTokens(res, user));
  } catch (err) {
    // Two signups with the same email at the same moment: the unique index catches the second.
    if ((err as { code?: number }).code === 11000) throw new HttpError(409, "An account with this email already exists");
    throw err;
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as Credentials;
  const user = await User.findOne({ email });

  // Same message for "no such user" and "wrong password", so attackers can't discover which emails exist.
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) throw new HttpError(401, "Invalid email or password");

  res.json(issueTokens(res, user));
}

/** New access token from the refresh cookie. Also rotates the refresh token. */
export async function refresh(req: Request, res: Response) {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new HttpError(401, "No refresh token");

  let payload: { sub: string; ver: number };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new HttpError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(payload.sub);
  // tokenVersion changes on logout, so a refresh token from before logout is rejected.
  if (!user || user.tokenVersion !== payload.ver) throw new HttpError(401, "Session expired, please log in again");

  res.json(issueTokens(res, user));
}

export async function logout(req: Request, res: Response) {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const { sub } = verifyRefreshToken(token);
      await User.updateOne({ _id: sub }, { $inc: { tokenVersion: 1 } });
    } catch {
      // Invalid token: nothing to revoke, still clear the cookie.
    }
  }
  const { maxAge: _maxAge, ...cookieOpts } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, cookieOpts);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  const user = await User.findById(req.userId).select("email createdAt");
  if (!user) throw new HttpError(404, "User not found");
  res.json({ user: { id: String(user._id), email: user.email, createdAt: user.createdAt } });
}
