import { parseBlock, readSse, type SseMessage } from "./sse";

function streamOf(chunks: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(body);
}

describe("readSse", () => {
  it("handles messages split across network chunks and skips heartbeats", async () => {
    const got: SseMessage[] = [];
    await readSse(
      streamOf(['event: review\ndata: {"id":"1"}\n', "\n: ping\n\nevent: iss", 'ue\ndata: {"line":2}\n\n']),
      (m) => got.push(m),
    );
    expect(got).toEqual([
      { event: "review", data: '{"id":"1"}' },
      { event: "issue", data: '{"line":2}' },
    ]);
  });
});

describe("parseBlock", () => {
  it("returns null for a comment-only block", () => {
    expect(parseBlock(": ping")).toBeNull();
  });
  it("defaults the event name to message", () => {
    expect(parseBlock("data: hi")).toEqual({ event: "message", data: "hi" });
  });
});
