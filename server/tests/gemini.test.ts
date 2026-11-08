import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fake @google/genai: each model name maps to a behaviour.
const behaviours: Record<string, "ok" | "silent" | "error"> = {};
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContentStream: async ({ model, config }: { model: string; config: { abortSignal: AbortSignal } }) => {
        const b = behaviours[model];
        if (b === "error") throw new Error(`${model} 503`);
        return (async function* () {
          if (b === "silent") {
            await new Promise((_, reject) => config.abortSignal.addEventListener("abort", () => reject(new Error("aborted"))));
          }
          yield { text: `{"type":"summary","title":"t","summary":"from ${model}"}\n` };
          yield { text: "", usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } };
        })();
      },
    };
  },
}));

process.env.GEMINI_MODEL = "main-model";
process.env.GEMINI_FALLBACK_MODEL = "backup-model";
process.env.GEMINI_FIRST_CHUNK_TIMEOUT_MS = "100";
const { streamReview } = await import("../src/services/gemini.js");

async function collect(stream: Awaited<ReturnType<typeof streamReview>>) {
  let text = "";
  for await (const c of stream.chunks) text += c;
  return text;
}

describe("streamReview fallback", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("uses the main model when it answers", async () => {
    behaviours["main-model"] = "ok";
    const s = await streamReview({ code: "x", language: "go" });
    expect(s.model).toBe("main-model");
    expect(await collect(s)).toMatch(/from main-model/);
    expect(s.usage()).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it("falls back when the main model errors", async () => {
    behaviours["main-model"] = "error";
    behaviours["backup-model"] = "ok";
    const s = await streamReview({ code: "x", language: "go" });
    expect(s.model).toBe("backup-model");
  });

  it("falls back when the main model is silent past the first-chunk timeout", async () => {
    behaviours["main-model"] = "silent";
    behaviours["backup-model"] = "ok";
    const s = await streamReview({ code: "x", language: "go" });
    expect(s.model).toBe("backup-model");
    expect(await collect(s)).toMatch(/from backup-model/);
  });

  it("throws when both models fail", async () => {
    behaviours["main-model"] = "error";
    behaviours["backup-model"] = "silent";
    await expect(streamReview({ code: "x", language: "go" })).rejects.toThrow();
  });

  it("does not try the fallback when the user already cancelled", async () => {
    behaviours["main-model"] = "silent";
    behaviours["backup-model"] = "ok";
    const ac = new AbortController();
    setTimeout(() => ac.abort(new Error("user left")), 20);
    await expect(streamReview({ code: "x", language: "go", signal: ac.signal })).rejects.toThrow();
  });
});
