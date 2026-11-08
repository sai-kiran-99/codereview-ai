import { GoogleGenAI } from "@google/genai";
import { env } from "../config.js";
import { REVIEW_SYSTEM_PROMPT, buildReviewPrompt } from "../prompts/review.js";

export const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

let client: GoogleGenAI | undefined;
function getClient(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
  return client;
}

export interface Usage { inputTokens?: number; outputTokens?: number }

export interface ReviewStream {
  /** Text pieces as the model writes them. */
  chunks: AsyncIterable<string>;
  /** Token counts, available after `chunks` is fully read. */
  usage: () => Usage;
}

/** Starts a streaming review. The API key stays on the server; the browser never sees it. */
export async function streamReview(opts: { code: string; language: string; signal?: AbortSignal }): Promise<ReviewStream> {
  const response = await getClient().models.generateContentStream({
    model: MODEL,
    contents: buildReviewPrompt(opts.code, opts.language),
    config: {
      systemInstruction: REVIEW_SYSTEM_PROMPT,
      temperature: 0.2, // low = more consistent, less made-up issues
      maxOutputTokens: 8192,
      abortSignal: opts.signal,
    },
  });

  const usage: Usage = {};
  async function* chunks() {
    for await (const piece of response) {
      if (piece.usageMetadata) {
        usage.inputTokens = piece.usageMetadata.promptTokenCount;
        usage.outputTokens = piece.usageMetadata.candidatesTokenCount;
      }
      const text = piece.text;
      if (text) yield text;
    }
  }

  return { chunks: chunks(), usage: () => usage };
}
