import { useCallback, useEffect, useReducer, useRef } from "react";
import { apiFetch, errorFrom } from "../api/client";
import { readSse } from "../api/sse";
import type { Issue, Language } from "../types";

export type StreamStatus = "idle" | "streaming" | "done" | "error" | "cancelled";

export interface StreamState {
  status: StreamStatus;
  reviewId: string | null;
  title: string | null;
  summary: string | null;
  issues: Issue[];
  error: string | null;
  latencyMs: number | null;
}

type Action =
  | { type: "start" }
  | { type: "review"; id: string }
  | { type: "summary"; title: string; summary: string }
  | { type: "issue"; issue: Issue }
  | { type: "done"; issues: Issue[]; latencyMs: number }
  | { type: "error"; message: string }
  | { type: "cancel" };

export const initialStreamState: StreamState = {
  status: "idle",
  reviewId: null,
  title: null,
  summary: null,
  issues: [],
  error: null,
  latencyMs: null,
};

/** Pure function: easy to test, and every state change is in one place. */
export function streamReducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case "start":
      return { ...initialStreamState, status: "streaming" };
    case "review":
      return { ...state, reviewId: action.id };
    case "summary":
      return { ...state, title: action.title, summary: action.summary };
    case "issue":
      return { ...state, issues: [...state.issues, action.issue] };
    case "done":
      // The server sends the final sorted list; use it as the source of truth.
      return { ...state, status: "done", issues: action.issues, latencyMs: action.latencyMs };
    case "error":
      return { ...state, status: "error", error: action.message };
    case "cancel":
      return { ...state, status: "cancelled" };
  }
}

export interface ReviewInput {
  code: string;
  language: Language;
  title?: string;
}

/**
 * Starts a review and updates state as SSE events arrive:
 * review (id) → summary → issue × N → done | error.
 */
export function useStreamingReview(options: { onFinish?: () => void } = {}) {
  const [state, dispatch] = useReducer(streamReducer, initialStreamState);
  const abortRef = useRef<AbortController | null>(null);
  const onFinishRef = useRef(options.onFinish);
  useEffect(() => {
    onFinishRef.current = options.onFinish;
  });

  const start = useCallback(async (input: ReviewInput) => {
    abortRef.current?.abort(); // only one review at a time
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "start" });

    let finished = false;
    try {
      const res = await apiFetch("/api/reviews", {
        method: "POST",
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      // Validation / rate-limit errors come back as normal JSON before any stream starts.
      if (!res.ok) throw await errorFrom(res);

      await readSse(res, ({ event, data }) => {
        const payload = JSON.parse(data);
        if (event === "review") dispatch({ type: "review", id: payload.id });
        else if (event === "summary") dispatch({ type: "summary", title: payload.title, summary: payload.summary });
        else if (event === "issue") dispatch({ type: "issue", issue: payload });
        else if (event === "done") {
          finished = true;
          dispatch({ type: "done", issues: payload.issues, latencyMs: payload.latencyMs });
        } else if (event === "error") {
          finished = true;
          dispatch({ type: "error", message: payload.message });
        }
      });

      if (!finished) dispatch({ type: "error", message: "Connection lost before the review finished." });
    } catch (err) {
      if (controller.signal.aborted) dispatch({ type: "cancel" });
      else dispatch({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      onFinishRef.current?.();
    }
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  // Leaving the page stops the stream (the server then stops calling Gemini).
  useEffect(() => () => abortRef.current?.abort(), []);

  return { ...state, start, cancel };
}
