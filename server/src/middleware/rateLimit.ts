import type { RequestHandler } from "express";

/**
 * Simple in-memory sliding-window limit per user (v1).
 * Fine for one server instance. v3 moves this to Redis so it works across instances and restarts.
 */
export function rateLimitPerUser(maxRequests: number, windowMs: number): RequestHandler {
  const hits = new Map<string, number[]>();

  return (req, res, next) => {
    const key = req.userId ?? req.ip ?? "anon";
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= maxRequests) {
      const retryAfterSec = Math.ceil((windowMs - (now - recent[0]!)) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: `Too many reviews. Try again in ${retryAfterSec}s.` });
      return;
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
