import { z } from "zod";
import { CATEGORIES, SEVERITIES } from "../models/Review.js";

/** Splits a stream of text chunks into complete lines. Chunks can end in the middle of a line. */
export class LineSplitter {
  private buffer = "";

  push(chunk: string): string[] {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? ""; // last part may be incomplete; keep it for the next chunk
    return lines;
  }

  flush(): string[] {
    const rest = this.buffer;
    this.buffer = "";
    return rest.trim() ? [rest] : [];
  }
}

const lower = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase().replace(/[\s_]+/g, "-") : v);

const summarySchema = z.object({
  type: z.literal("summary"),
  title: z.string().trim().max(120).catch("Code review"),
  summary: z.string().trim().min(1),
});

const issueSchema = z.object({
  type: z.literal("issue"),
  line: z.coerce.number().int().min(1),
  severity: z.preprocess(lower, z.enum(SEVERITIES)),
  category: z.preprocess(lower, z.enum(CATEGORIES)),
  message: z.string().trim().min(1),
  suggestion: z.string().trim().default(""),
});

export type ReviewSummary = { title: string; summary: string };
export type ReviewIssue = Omit<z.infer<typeof issueSchema>, "type">;
export type ParsedLine = { kind: "summary"; value: ReviewSummary } | { kind: "issue"; value: ReviewIssue };

/**
 * Parses one NDJSON line from the model. Returns null for blank lines, code fences, broken JSON
 * or objects that fail validation, so one bad line never breaks the whole review.
 */
export function parseReviewLine(rawLine: string, totalLines: number): ParsedLine | null {
  const line = rawLine.trim().replace(/,$/, ""); // tolerate a trailing comma
  if (!line.startsWith("{")) return null;

  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return null;
  }

  const summary = summarySchema.safeParse(json);
  if (summary.success) return { kind: "summary", value: { title: summary.data.title, summary: summary.data.summary } };

  const issue = issueSchema.safeParse(json);
  if (issue.success) {
    const { type: _type, ...value } = issue.data;
    // The model sometimes cites a line past the end; clamp so the UI can always highlight it.
    value.line = Math.min(value.line, Math.max(totalLines, 1));
    return { kind: "issue", value };
  }

  return null;
}

const SEVERITY_RANK: Record<ReviewIssue["severity"], number> = { critical: 0, major: 1, minor: 2, info: 3 };

export function sortIssues(issues: ReviewIssue[]): ReviewIssue[] {
  return [...issues].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.line - b.line);
}
