export interface SseMessage {
  event: string;
  data: string;
}

/**
 * Reads a Server-Sent Events stream from a fetch() Response.
 * We can't use the browser's EventSource because it only does GET without custom headers,
 * and we need POST (the code is in the body) + an Authorization header.
 *
 * Format: blocks separated by a blank line, each with "event: x" and "data: {...}" lines.
 * Lines starting with ":" are comments (our heartbeats) and are skipped.
 */
export async function readSse(res: Response, onMessage: (msg: SseMessage) => void): Promise<void> {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    // A network chunk can end mid-message: only handle complete blocks, keep the rest.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const msg = parseBlock(block);
      if (msg) onMessage(msg);
    }
  }
}

export function parseBlock(block: string): SseMessage | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return data.length ? { event, data: data.join("\n") } : null;
}
