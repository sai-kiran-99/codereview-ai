import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import type { Express } from "express";

let mongo: MongoMemoryServer | undefined;

export async function startDb() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}

export async function stopDb() {
  await mongoose.disconnect();
  await mongo?.stop();
}

let counter = 0;
/** Signs up a fresh user and returns their access token and refresh cookie. */
export async function signupUser(app: Express, email = `user${++counter}-${Date.now()}@test.dev`) {
  const res = await request(app).post("/api/auth/signup").send({ email, password: "password123" });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = ([] as string[]).concat(res.headers["set-cookie"] ?? [])[0] ?? "";
  return { token: res.body.accessToken as string, cookie, email, id: res.body.user.id as string };
}

export interface SseEvent { event: string; data: any }

/** Parses an SSE body ("event: x\ndata: {...}\n\n" blocks) into a list of events. */
export function parseSse(body: string): SseEvent[] {
  return body
    .split("\n\n")
    .map((block) => {
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      return event && data ? { event, data: JSON.parse(data) } : null;
    })
    .filter((e): e is SseEvent => e !== null);
}
