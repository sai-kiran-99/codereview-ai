import type { RequestHandler } from "express";
import type { ZodType } from "zod";

/** Validates req.body against a zod schema. Replaces req.body with the parsed (trimmed, typed) value. */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const first = result.error.issues[0];
      const field = first?.path.join(".") || "body";
      res.status(400).json({ error: `${field}: ${first?.message ?? "invalid"}` });
      return;
    }
    req.body = result.data;
    next();
  };
}
