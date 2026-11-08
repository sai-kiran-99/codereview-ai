import type { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/tokens.js";
import { HttpError } from "./errorHandler.js";

/** Requires "Authorization: Bearer <access token>". Sets req.userId. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return next(new HttpError(401, "Not logged in"));

  try {
    req.userId = verifyAccessToken(token).sub;
    next();
  } catch {
    // Expired or tampered. The client should call /api/auth/refresh and retry.
    next(new HttpError(401, "Invalid or expired token"));
  }
};
