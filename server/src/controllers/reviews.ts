import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { LANGUAGES, Review, SEVERITIES } from "../models/Review.js";
import { HttpError } from "../middleware/errorHandler.js";
import { MODEL, streamReview } from "../services/gemini.js";
import { LineSplitter, parseReviewLine, sortIssues, type ReviewIssue } from "../services/reviewParser.js";

export const MAX_CODE_BYTES = 20_000;

export const createReviewSchema = z.object({
  code: z
    .string()
    .refine((c) => c.trim().length > 0, "is empty")
    .refine((c) => Buffer.byteLength(c, "utf8") <= MAX_CODE_BYTES, `must be at most ${MAX_CODE_BYTES / 1000} KB`),
  language: z.enum(LANGUAGES),
  title: z.string().trim().max(120).optional(),
});
type CreateReviewBody = z.infer<typeof createReviewSchema>;

const HEARTBEAT_MS = 15_000;

/**
 * POST /api/reviews — runs a review and streams it with Server-Sent Events.
 * Events: review {id} → summary {title, summary} → issue {...} (one per issue) → done {...} | error {message}
 */
export async function createReview(req: Request, res: Response) {
  const { code, language, title } = req.body as CreateReviewBody;
  const startedAt = Date.now();

  // 1. Save first with status "running", so the review shows in history even if streaming fails.
  const review = await Review.create({
    userId: req.userId,
    language,
    code,
    title: title || "Untitled review",
    model: MODEL,
  });

  // 2. Switch the response to an SSE stream. From here on, errors are sent as "error" events, not JSON.
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // stop proxies from buffering the stream
  });
  const send = (event: string, data: unknown) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  send("review", { id: String(review._id) });

  // Comment lines keep idle connections from being closed by proxies while the model thinks.
  const heartbeat = setInterval(() => !res.writableEnded && res.write(": ping\n\n"), HEARTBEAT_MS);

  // 3. If the user closes the tab, stop the Gemini call (saves tokens).
  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });

  const totalLines = code.split("\n").length;
  let summary: { title: string; summary: string } | undefined;
  const issues: ReviewIssue[] = [];

  const handleLine = (line: string) => {
    const parsed = parseReviewLine(line, totalLines);
    if (!parsed) return;
    if (parsed.kind === "summary" && !summary) {
      summary = parsed.value;
      send("summary", summary);
    } else if (parsed.kind === "issue") {
      issues.push(parsed.value);
      send("issue", parsed.value);
    }
  };

  try {
    // 4. Stream from Gemini, split into lines, validate each line, forward valid ones immediately.
    const stream = await streamReview({ code, language, signal: abort.signal });
    const splitter = new LineSplitter();
    for await (const chunk of stream.chunks) {
      for (const line of splitter.push(chunk)) handleLine(line);
    }
    for (const line of splitter.flush()) handleLine(line);

    if (!summary && issues.length === 0) throw new Error("AI response could not be parsed");

    // 5. Save the final result.
    const sorted = sortIssues(issues);
    const usage = stream.usage();
    const latencyMs = Date.now() - startedAt;
    await Review.updateOne(
      { _id: review._id },
      {
        status: "done",
        title: title || summary?.title || "Untitled review",
        summary: summary?.summary ?? "",
        issues: sorted,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        latencyMs,
      },
    );
    send("done", { id: String(review._id), status: "done", summary: summary?.summary ?? "", issues: sorted, latencyMs });
  } catch (err) {
    const cancelled = abort.signal.aborted;
    console.error(`Review ${review._id} failed:`, err instanceof Error ? err.message : err);
    await Review.updateOne(
      { _id: review._id },
      { status: "failed", error: cancelled ? "Cancelled" : "AI review failed", latencyMs: Date.now() - startedAt },
    ).catch(() => {});
    // Don't forward raw provider errors to the browser.
    send("error", { message: "The AI review failed. Please try again." });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(50).catch(10),
  q: z.string().trim().max(100).optional().catch(undefined),
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** GET /api/reviews?page=1&limit=10&q=auth — my reviews, newest first, without the code. */
export async function listReviews(req: Request, res: Response) {
  const { page, limit, q } = listQuerySchema.parse(req.query);
  const filter: Record<string, unknown> = { userId: req.userId };
  if (q) filter.title = { $regex: escapeRegex(q), $options: "i" };

  const [docs, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("title language status summary issues.severity createdAt latencyMs")
      .lean(),
    Review.countDocuments(filter),
  ]);

  const items = docs.map((d) => {
    const issueCounts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<(typeof SEVERITIES)[number], number>;
    for (const issue of d.issues) issueCounts[issue.severity]++;
    return {
      id: String(d._id),
      title: d.title,
      language: d.language,
      status: d.status,
      summary: d.summary,
      issueCounts,
      createdAt: d.createdAt,
      latencyMs: d.latencyMs,
    };
  });

  res.json({ items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
}

async function findOwnReview(req: Request) {
  const id = String(req.params.id);
  // Someone else's review returns 404, not 403, so ids of other users' reviews aren't confirmed.
  if (!isValidObjectId(id)) throw new HttpError(404, "Review not found");
  const review = await Review.findOne({ _id: id, userId: req.userId }).lean();
  if (!review) throw new HttpError(404, "Review not found");
  return review;
}

export async function getReview(req: Request, res: Response) {
  const { _id, userId: _userId, __v: _v, ...rest } = await findOwnReview(req);
  res.json({ review: { id: String(_id), ...rest } });
}

export async function deleteReview(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) throw new HttpError(404, "Review not found");
  const { deletedCount } = await Review.deleteOne({ _id: id, userId: req.userId });
  if (deletedCount === 0) throw new HttpError(404, "Review not found");
  res.status(204).end();
}
