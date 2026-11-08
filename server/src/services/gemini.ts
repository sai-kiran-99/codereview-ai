import { GoogleGenAI } from "@google/genai";
import { env } from "../config.js";
import { REVIEW_SYSTEM_PROMPT, buildReviewPrompt } from "../prompts/review.js";

export const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
/** Used when the main model fails or doesn't start answering in time. Set to "" to disable. */
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.6-flash";

/** No first chunk within this time → give up on this model and try the fallback. */
const FIRST_CHUNK_TIMEOUT_MS = Number(process.env.GEMINI_FIRST_CHUNK_TIMEOUT_MS) || 20_000;
/** Hard limit for a whole review, so a request can never hang forever. */
const TOTAL_TIMEOUT_MS = 120_000;

let client: GoogleGenAI | undefined;
function getClient(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
  return client;
}

export interface Usage { inputTokens?: number; outputTokens?: number }

export interface ReviewStream {
  /** The model that actually answered (main or fallback). */
  model: string;
  /** Text pieces as the model writes them. */
  chunks: AsyncIterable<string>;
  /** Token counts, available after `chunks` is fully read. */
  usage: () => Usage;
}

/**
 * Starts one streaming call and waits for its first text chunk.
 * Throws if the model errors or sends nothing within FIRST_CHUNK_TIMEOUT_MS.
 */
async function startModel(model: string, prompt: string, outerSignal: AbortSignal): Promise<ReviewStream> {
  const attempt = new AbortController();
  const firstChunkTimer = setTimeout(() => attempt.abort(new Error(`${model}: no response in ${FIRST_CHUNK_TIMEOUT_MS} ms`)), FIRST_CHUNK_TIMEOUT_MS);
  const signal = AbortSignal.any([outerSignal, attempt.signal]);

  try {
    const response = await getClient().models.generateContentStream({
      model,
      contents: prompt,
      config: {
        systemInstruction: REVIEW_SYSTEM_PROMPT,
        temperature: 0.2, // low = more consistent, fewer made-up issues
        maxOutputTokens: 8192,
        abortSignal: signal,
      },
    });

    const usage: Usage = {};
    const iterator = response[Symbol.asyncIterator]();

    // Read until the first piece of real text, so a silent model is caught here.
    const buffered: string[] = [];
    while (buffered.length === 0) {
      const next = await Promise.race([
        iterator.next(),
        new Promise<never>((_, reject) => {
          if (signal.aborted) reject(signal.reason);
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
      ]);
      if (next.done) break;
      if (next.value.usageMetadata) {
        usage.inputTokens = next.value.usageMetadata.promptTokenCount;
        usage.outputTokens = next.value.usageMetadata.candidatesTokenCount;
      }
      if (next.value.text) buffered.push(next.value.text);
    }
    clearTimeout(firstChunkTimer);

    async function* chunks() {
      yield* buffered;
      for (;;) {
        const next = await iterator.next();
        if (next.done) return;
        if (next.value.usageMetadata) {
          usage.inputTokens = next.value.usageMetadata.promptTokenCount;
          usage.outputTokens = next.value.usageMetadata.candidatesTokenCount;
        }
        if (next.value.text) yield next.value.text;
      }
    }

    return { model, chunks: chunks(), usage: () => usage };
  } catch (err) {
    clearTimeout(firstChunkTimer);
    attempt.abort();
    throw err;
  }
}

/**
 * Starts a streaming review. Tries the main model, then the fallback if the main one
 * fails or stays silent. The API key stays on the server; the browser never sees it.
 */
export async function streamReview(opts: { code: string; language: string; signal?: AbortSignal }): Promise<ReviewStream> {
  const prompt = buildReviewPrompt(opts.code, opts.language);
  const signals = [AbortSignal.timeout(TOTAL_TIMEOUT_MS)];
  if (opts.signal) signals.push(opts.signal);
  const outer = AbortSignal.any(signals);

  const models = [MODEL, FALLBACK_MODEL].filter((m, i, all) => m && all.indexOf(m) === i);
  let lastError: unknown;
  for (const model of models) {
    if (opts.signal?.aborted) break; // user left: don't try another model
    try {
      return await startModel(model, prompt, outer);
    } catch (err) {
      lastError = err;
      console.warn(`Gemini ${model} failed:`, err instanceof Error ? err.message : err);
    }
  }
  throw lastError ?? new Error("Review cancelled");
}
