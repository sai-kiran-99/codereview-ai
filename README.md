# CodeReview AI

**Live:** [codereview-ai-silk.vercel.app](https://codereview-ai-silk.vercel.app) · API: [codereview-ai-api.onrender.com/health](https://codereview-ai-api.onrender.com/health) (free tier: the first request after idle takes ~50 s)

Paste code, get an AI code review streamed live: a summary first, then each issue with **severity**, **line number**, **category**, an explanation and a **suggested fix**.

**Stack:** React + TypeScript + Vite + Tailwind · React Query + Zustand · Node + Express + TypeScript · MongoDB (Mongoose) · Gemini (`@google/genai`) · zod · SSE · JWT (access token in memory + httpOnly refresh cookie)

## Features (v1)
- Sign up / log in with email + password (bcrypt, JWT, rotating refresh tokens revoked on logout)
- New Review: code editor with line numbers, language select, 20 KB limit
- Review streams over **Server-Sent Events**: the model answers in NDJSON, every line is validated with zod and forwarded the moment it arrives
- History with search + pagination, review detail with issues marked on code lines, delete
- Per-user rate limit, failed/cancelled reviews tracked (`running` → `done` | `failed`)

## How a review works
```
Browser ──POST /api/reviews (code, language)──▶ Express
  requireAuth (JWT) → rate limit → zod validation
  save Review {status: "running"}
  Gemini generateContentStream ──▶ text chunks
     LineSplitter → JSON.parse each line → zod → SSE event
  ◀── event: review │ summary │ issue … │ done (or error)
  save Review {status: "done", issues, tokens, latencyMs}
```
Details and trade-offs: [docs/EXPLAIN.md](docs/EXPLAIN.md). Plan: [docs/PLAN.md](docs/PLAN.md).

## Run locally
Needs Node 20+ and a MongoDB Atlas cluster (or local MongoDB) and a Gemini API key.

```bash
cd server && cp .env.example .env   # fill in the values
npm install && npm run dev          # http://localhost:4000/health
```
```bash
cd client && cp .env.example .env   # leave VITE_API_URL empty in dev
npm install && npm run dev          # http://localhost:5173
```
Vite proxies `/api` to the server in development, so no CORS setup is needed locally.

## Tests
```bash
cd server && npm test   # 40 tests: auth, SSE review flow, parser, limits (in-memory MongoDB, mocked Gemini)
cd client && npm test   # SSE reader, streaming hook, components
```

## Deploy
- **API → Render:** New → Blueprint → this repo (uses `render.yaml`). Set `MONGODB_URI`, `GEMINI_API_KEY`, `CLIENT_URL`. In Atlas → Network Access allow `0.0.0.0/0` (Render free has no fixed IP).
- **Client → Vercel:** import the repo, root directory `client`, framework Vite, env `VITE_API_URL=<Render URL>`.

## Roadmap
v2: repo-aware reviews with RAG (Atlas Vector Search) · v3: agent that reviews a GitHub PR with tool calling, Redis rate limits + caching · Polish: CI, eval set of seeded bugs.
