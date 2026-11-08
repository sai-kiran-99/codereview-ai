import { act, renderHook, waitFor } from "@testing-library/react";
import { initialStreamState, streamReducer, useStreamingReview } from "./useStreamingReview";
import type { Issue } from "../types";

const issue = (line: number, severity: Issue["severity"]): Issue => ({ line, severity, category: "bug", message: "m", suggestion: "" });

describe("streamReducer", () => {
  it("start resets previous results", () => {
    const dirty = { ...initialStreamState, status: "done" as const, issues: [issue(1, "minor")], error: "x" };
    expect(streamReducer(dirty, { type: "start" })).toEqual({ ...initialStreamState, status: "streaming" });
  });

  it("appends issues as they stream, then done replaces them with the sorted list", () => {
    let s = streamReducer(initialStreamState, { type: "start" });
    s = streamReducer(s, { type: "issue", issue: issue(5, "minor") });
    s = streamReducer(s, { type: "issue", issue: issue(2, "critical") });
    expect(s.issues.map((i) => i.line)).toEqual([5, 2]);
    s = streamReducer(s, { type: "done", issues: [issue(2, "critical"), issue(5, "minor")], latencyMs: 1200 });
    expect(s.status).toBe("done");
    expect(s.issues.map((i) => i.line)).toEqual([2, 5]);
  });
});

function sseResponse(text: string, status = 200) {
  return new Response(text, { status, headers: { "Content-Type": "text/event-stream" } });
}

describe("useStreamingReview", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("goes streaming → done with summary and issues from the SSE stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse(
          'event: review\ndata: {"id":"abc"}\n\n' +
            'event: summary\ndata: {"title":"T","summary":"S"}\n\n' +
            'event: issue\ndata: {"line":1,"severity":"major","category":"bug","message":"m","suggestion":""}\n\n' +
            'event: done\ndata: {"issues":[{"line":1,"severity":"major","category":"bug","message":"m","suggestion":""}],"latencyMs":900}\n\n',
        ),
      ),
    );
    const onFinish = vi.fn();
    const { result } = renderHook(() => useStreamingReview({ onFinish }));

    await act(() => result.current.start({ code: "x", language: "javascript" }));

    expect(result.current.status).toBe("done");
    expect(result.current.reviewId).toBe("abc");
    expect(result.current.summary).toBe("S");
    expect(result.current.issues).toHaveLength(1);
    expect(onFinish).toHaveBeenCalled();
  });

  it("shows the server's JSON error (e.g. 429) before any stream starts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Too many reviews. Try again in 60s." }, { status: 429 })));
    const { result } = renderHook(() => useStreamingReview());
    await act(() => result.current.start({ code: "x", language: "javascript" }));
    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/Too many reviews/);
  });

  it("reports a lost connection when the stream ends without done", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse('event: review\ndata: {"id":"abc"}\n\n')));
    const { result } = renderHook(() => useStreamingReview());
    await act(() => result.current.start({ code: "x", language: "javascript" }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/Connection lost/);
  });
});
