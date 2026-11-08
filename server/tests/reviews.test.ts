import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Review } from "../src/models/Review.js";
import { parseSse, signupUser, startDb, stopDb } from "./helpers.js";

// Replace the real Gemini call with a fake stream we control.
vi.mock("../src/services/gemini.js", () => ({ MODEL: "test-model", streamReview: vi.fn() }));
const { streamReview } = await import("../src/services/gemini.js");
const mockStream = vi.mocked(streamReview);

function fakeModel(chunks: string[]) {
  mockStream.mockResolvedValue({
    chunks: (async function* () {
      for (const c of chunks) yield c;
    })(),
    usage: () => ({ inputTokens: 100, outputTokens: 50 }),
  });
}

const GOOD_OUTPUT = [
  '{"type":"summary","title":"Sum function","summary":"Mostly fine."}\n{"type":"issue","line":2,"severity":"mi',
  'nor","category":"readability","message":"Unclear name","suggestion":"Rename x"}\n',
  "```json\n", // junk the model sometimes adds — ignored
  '{"type":"issue","line":1,"severity":"critical","category":"security","message":"eval on input","suggestion":"Remove eval"}',
];

const app = createApp();
beforeAll(startDb);
afterAll(stopDb);
beforeEach(() => mockStream.mockReset());

const post = (token: string, body: object) =>
  request(app).post("/api/reviews").set("Authorization", `Bearer ${token}`).send(body);

describe("POST /api/reviews (SSE)", () => {
  it("streams review → summary → issues → done and saves the result", async () => {
    const { token } = await signupUser(app);
    fakeModel(GOOD_OUTPUT);

    const res = await post(token, { code: "eval(input)\nconst x = 1;", language: "javascript" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);

    const events = parseSse(res.text);
    expect(events.map((e) => e.event)).toEqual(["review", "summary", "issue", "issue", "done"]);
    expect(events[1]!.data.summary).toBe("Mostly fine.");

    const done = events.at(-1)!.data;
    expect(done.issues.map((i: { severity: string }) => i.severity)).toEqual(["critical", "minor"]); // sorted

    const saved = await Review.findById(events[0]!.data.id).lean();
    expect(saved?.status).toBe("done");
    expect(saved?.title).toBe("Sum function");
    expect(saved?.issues).toHaveLength(2);
    expect(saved?.inputTokens).toBe(100);
    expect(saved?.latencyMs).toEqual(expect.any(Number));
  });

  it("marks the review failed and sends an error event when the model throws", async () => {
    const { token } = await signupUser(app);
    // The stream starts, sends a summary, then the provider fails mid-way.
    mockStream.mockResolvedValue({
      chunks: (async function* () {
        yield '{"type":"summary","title":"t","summary":"partial"}\n';
        throw new Error("upstream 500 with secret details");
      })(),
      usage: () => ({}),
    });

    const res = await post(token, { code: "let a = 1", language: "javascript" });
    const events = parseSse(res.text);
    expect(events.map((e) => e.event)).toEqual(["review", "summary", "error"]);
    expect(events.at(-1)!.data.message).not.toMatch(/secret/); // provider errors are not leaked
    expect((await Review.findById(events[0]!.data.id))?.status).toBe("failed");
  });

  it("fails when the model output can't be parsed at all", async () => {
    const { token } = await signupUser(app);
    fakeModel(["Sure! Here is my review in prose, not JSON."]);
    const events = parseSse((await post(token, { code: "x", language: "python" })).text);
    expect(events.at(-1)!.event).toBe("error");
    expect((await Review.findById(events[0]!.data.id))?.status).toBe("failed");
  });

  it.each([
    ["empty code", { code: "   ", language: "javascript" }, /code: is empty/],
    ["missing code", { language: "javascript" }, /code/],
    ["code over 20 KB", { code: "a".repeat(20_001), language: "javascript" }, /20 KB/],
    ["unknown language", { code: "x", language: "klingon" }, /language/],
  ])("rejects %s with 400 JSON (no stream started)", async (_n, body, msg) => {
    const { token } = await signupUser(app);
    const res = await post(token, body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(msg);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("requires login", async () => {
    expect((await request(app).post("/api/reviews").send({ code: "x", language: "go" })).status).toBe(401);
  });

  it("rate limits per user (REVIEWS_PER_HOUR=5 in tests)", async () => {
    const { token } = await signupUser(app);
    for (let i = 0; i < 5; i++) {
      fakeModel(['{"type":"summary","title":"t","summary":"ok"}']);
      expect((await post(token, { code: "x", language: "go" })).status).toBe(200);
    }
    const res = await post(token, { code: "x", language: "go" });
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
  });
});

describe("GET/DELETE /api/reviews", () => {
  async function seed(userId: string, n: number) {
    for (let i = 0; i < n; i++) {
      await Review.create({
        userId,
        language: "javascript",
        code: "secret code",
        title: i === 0 ? "Auth bug" : `Review ${i}`,
        status: "done",
        issues: [
          { line: 1, severity: "critical", category: "bug", message: "m" },
          { line: 2, severity: "minor", category: "bug", message: "m" },
        ],
      });
    }
  }

  it("lists my reviews with pagination, issue counts and no code", async () => {
    const me = await signupUser(app);
    const other = await signupUser(app);
    await seed(me.id, 12);
    await seed(other.id, 3);

    const res = await request(app).get("/api/reviews?page=2&limit=5").set("Authorization", `Bearer ${me.token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(12);
    expect(res.body.totalPages).toBe(3);
    expect(res.body.items).toHaveLength(5);
    expect(res.body.items[0].issueCounts).toEqual({ critical: 1, major: 0, minor: 1, info: 0 });
    expect(res.body.items[0].code).toBeUndefined();
  });

  it("searches by title (regex characters are escaped)", async () => {
    const me = await signupUser(app);
    await seed(me.id, 3);
    const auth = { Authorization: `Bearer ${me.token}` };
    expect((await request(app).get("/api/reviews?q=auth").set(auth)).body.total).toBe(1);
    expect((await request(app).get("/api/reviews?q=.*").set(auth)).body.total).toBe(0);
  });

  it("gets and deletes my own review; others' reviews are 404", async () => {
    const me = await signupUser(app);
    const other = await signupUser(app);
    await seed(me.id, 1);
    const id = (await Review.findOne({ userId: me.id }))!._id.toString();

    const mine = await request(app).get(`/api/reviews/${id}`).set("Authorization", `Bearer ${me.token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.review.code).toBe("secret code");
    expect(mine.body.review.userId).toBeUndefined();

    expect((await request(app).get(`/api/reviews/${id}`).set("Authorization", `Bearer ${other.token}`)).status).toBe(404);
    expect((await request(app).delete(`/api/reviews/${id}`).set("Authorization", `Bearer ${other.token}`)).status).toBe(404);
    expect((await request(app).get("/api/reviews/not-an-id").set("Authorization", `Bearer ${me.token}`)).status).toBe(404);

    expect((await request(app).delete(`/api/reviews/${id}`).set("Authorization", `Bearer ${me.token}`)).status).toBe(204);
    expect((await request(app).get(`/api/reviews/${id}`).set("Authorization", `Bearer ${me.token}`)).status).toBe(404);
  });
});
