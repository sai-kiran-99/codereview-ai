import type { ErrorRequestHandler, RequestHandler } from "express";

/** Error with an HTTP status. Throw this from a route to send that status. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Runs when no route matched. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Central error handler. Express 5 forwards errors thrown in async routes here too.
 * Hides internal error messages in production so stack details never leak to clients.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const isHttpError = err instanceof HttpError;
  // body-parser errors (bad JSON, body too large) carry their own 4xx status.
  const status: number = isHttpError ? err.status : (err?.status ?? err?.statusCode ?? 500);
  const isProd = process.env.NODE_ENV === "production";

  if (status >= 500) console.error(err);

  const message =
    status >= 500 && isProd ? "Internal server error" : (err?.message ?? "Something went wrong");

  res.status(status).json({ error: message });
};
