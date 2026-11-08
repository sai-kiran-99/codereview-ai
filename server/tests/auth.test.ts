import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { signupUser, startDb, stopDb } from "./helpers.js";

const app = createApp();
beforeAll(startDb);
afterAll(stopDb);

describe("POST /api/auth/signup", () => {
  it("creates a user, returns an access token and sets an httpOnly refresh cookie", async () => {
    const res = await request(app).post("/api/auth/signup").send({ email: "  New@Test.dev ", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe("new@test.dev"); // trimmed + lowercased
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/refreshToken=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app).post("/api/auth/signup").send({ email: "dup@test.dev", password: "password123" });
    const res = await request(app).post("/api/auth/signup").send({ email: "DUP@test.dev", password: "password123" });
    expect(res.status).toBe(409);
  });

  it.each([
    ["missing body", {}, /email/],
    ["invalid email", { email: "nope", password: "password123" }, /email/],
    ["short password", { email: "a@test.dev", password: "short" }, /password/],
    ["missing password", { email: "a@test.dev" }, /password/],
  ])("rejects %s with 400", async (_name, body, msg) => {
    const res = await request(app).post("/api/auth/signup").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(msg);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with the right password", async () => {
    const { email } = await signupUser(app);
    const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    const { email } = await signupUser(app);
    const wrong = await request(app).post("/api/auth/login").send({ email, password: "wrongpass1" });
    const unknown = await request(app).post("/api/auth/login").send({ email: "ghost@test.dev", password: "password123" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user with a valid token", async () => {
    const { token, email } = await signupUser(app);
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it.each([
    ["no header", undefined],
    ["garbage token", "Bearer not-a-jwt"],
    ["wrong scheme", "Token abc"],
  ])("returns 401 with %s", async (_name, header) => {
    const req = request(app).get("/api/auth/me");
    if (header) req.set("Authorization", header);
    expect((await req).status).toBe(401);
  });
});

describe("refresh + logout", () => {
  it("returns a new access token from the refresh cookie", async () => {
    const { cookie } = await signupUser(app);
    const res = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("returns 401 without a cookie", async () => {
    expect((await request(app).post("/api/auth/refresh")).status).toBe(401);
  });

  it("rejects the old refresh cookie after logout", async () => {
    const { cookie } = await signupUser(app);
    const out = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(out.status).toBe(204);
    expect(String(out.headers["set-cookie"])).toMatch(/refreshToken=;/);
    const res = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(res.status).toBe(401);
  });
});
