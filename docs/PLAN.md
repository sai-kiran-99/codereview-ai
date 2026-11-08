# CodeReview AI: Project Plan

Owner: Sai Kiran Madala · Started: Nov 8, 2026 · Status: v1 in progress

---

## 1. What it is

A web app where a developer pastes code, or connects a GitHub repo or pull request, and gets an AI code review:
issues with **severity**, **line numbers**, **category**, an **explanation** and a **suggested fix**, streamed live.
From v2 the review understands the **whole repository** (RAG), and from v3 an **agent** decides which files to read.

**Why this project:** it replaces the empty CodeReview AI repo on the resume with a real, deployed product that shows
React + TypeScript depth, a Node backend, LLM integration, RAG, agents, rate limiting, testing and evals.

---

## 2. Versions and timeline

| Version | Tracker days | Scope | Done when |
|---|---|---|---|
| **v1: Core review** | Days 1–2 (Nov 8–9) | Auth · paste code → streamed structured review · history · deploy | Live URL works end to end |
| **v2: Repo-aware (RAG)** | Days 15–19 | Index a public GitHub repo · vector search · reviews cite related files · "Ask the codebase" chat | Review mentions a related file correctly |
| **v3: Agent + scale** | Days 20–21 | Review a PR by URL with tool calling · Redis rate limits + caching · token cost tracking | Agent reviews a real PR |
| **Polish** | Days 22–23 | Tests + CI · eval set · README, diagram, demo video | Eval numbers measured, README done |

---

## 3. Features

### v1
- Sign up / log in (email + password, JWT)
- New Review page: code editor, language select, **Review** button
- Review streams in live (SSE): summary first, then issues one by one
- Each issue: line, severity (`critical` / `major` / `minor` / `info`), category (`bug`, `security`, `performance`, `readability`, `best-practice`), message, suggested fix
- Review history list + review detail page
- Basic limits: max code size, simple per-user rate limit
- Deployed: frontend on Vercel, backend on Render

### v2: RAG
- Connect a **public** GitHub repo URL
- Server fetches files (skip `node_modules`, binaries, lock files), splits them into chunks (by function or ~60 lines)
- Creates embeddings (Gemini embedding model), stores them in **MongoDB Atlas Vector Search**
- When reviewing a snippet from that repo: retrieve the top related chunks and add them to the prompt
- Review cites sources: "this change breaks the call in `src/utils/date.ts:42`"
- "Ask the codebase" chat with citations

### v3: Agent + scale
- Paste a GitHub PR URL → fetch the diff
- Agent loop with tools: `list_files`, `read_file`, `search_code` (vector search)
- The model decides which files to read, then writes the review
- Upstash Redis: rate limiting per user, cache identical reviews (hash of code + model)
- Track tokens, cost and latency per review

### Polish
- Unit tests (server: parsing, auth; client: key components) + GitHub Actions CI
- **Eval set:** 20 code snippets with known seeded bugs → measure detection rate and false positives
- README with architecture diagram, screenshots, 1-minute demo video

---

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind | Main skill, fast setup |
| State | Zustand (UI state) + React Query (server data) | Common in product companies |
| Editor | `@monaco-editor/react` or a simple textarea in v1 | Monaco looks professional |
| Backend | Node + Express + TypeScript | Same language end to end |
| Validation | zod | Validate requests and AI JSON output |
| Database | MongoDB Atlas (Mongoose) | Data + vector search in one place |
| AI | Gemini 3.8 Flash (reviews) + Gemini embedding model (RAG) | Free tier, already have an account |
| Streaming | **SSE** (Server-Sent Events) | One-way server → client stream, simpler than WebSockets |
| Cache / limits | Upstash Redis | Serverless, free tier |
| Auth | JWT access token + refresh token in httpOnly cookie, bcrypt | Standard interview topic |
| Deploy | Vercel (client) + Render (server) | Free tiers |

---

## 5. Architecture

```
Browser (React)
   │  POST /api/reviews  (code, language)
   ▼
Express API ── auth middleware (JWT) ── rate limit (Redis, v3)
   │
   ├─ save Review {status: "running"} in MongoDB
   ├─ build prompt (+ retrieved chunks in v2)
   ├─ call Gemini with streaming
   │      └─ forward each piece to the browser over SSE
   ├─ parse + validate final JSON with zod
   └─ update Review {status: "done", issues, summary, tokens, latencyMs}

v2 indexing:  repo URL → fetch files → chunk → embed → MongoDB (Chunk + vector index)
v3 agent:     PR URL → diff → loop { model picks a tool → server runs it → result back } → final review
```

---

## 6. Data model (MongoDB)

```ts
User {
  _id, email (unique), passwordHash, createdAt
}

Review {
  _id, userId, title, language,
  code,                       // max ~20 KB in v1
  status: "running" | "done" | "failed",
  summary,
  issues: [{ line, severity, category, message, suggestion }],
  repoId?,                    // v2
  model, inputTokens, outputTokens, latencyMs,
  createdAt
}

Repo {                        // v2
  _id, userId, url, status: "indexing" | "ready" | "failed",
  fileCount, chunkCount, indexedAt
}

Chunk {                       // v2
  _id, repoId, path, startLine, endLine, content,
  embedding: number[]         // Atlas Vector Search index on this field
}
```

---

## 7. API

| Method | Route | Version | What it does |
|---|---|---|---|
| POST | `/api/auth/signup` | v1 | Create user |
| POST | `/api/auth/login` | v1 | Returns access token, sets refresh cookie |
| POST | `/api/auth/refresh` | v1 | New access token from cookie |
| POST | `/api/auth/logout` | v1 | Clear cookie |
| GET | `/api/auth/me` | v1 | Current user |
| POST | `/api/reviews` | v1 | Start a review, **streams over SSE** |
| GET | `/api/reviews` | v1 | List my reviews (paginated) |
| GET | `/api/reviews/:id` | v1 | One review |
| DELETE | `/api/reviews/:id` | v1 | Delete a review |
| POST | `/api/repos` | v2 | Start indexing a repo |
| GET | `/api/repos/:id` | v2 | Indexing status |
| POST | `/api/repos/:id/ask` | v2 | Ask the codebase (streams) |
| POST | `/api/reviews/pr` | v3 | Agent review of a PR URL (streams) |

---

## 8. Pages

1. **Login / Sign up**
2. **New Review**: editor on the left, live results on the right (summary, then issue cards sorted by severity)
3. **History**: list with date, language, issue counts, search, pagination
4. **Review detail**: code with issue markers on lines + issue list
5. **Repos** (v2): connect a repo, indexing progress
6. **Ask the codebase** (v2): chat with file citations

---

## 9. Folder structure

```
codereview-ai/
├─ client/
│  └─ src/
│     ├─ api/            # fetch helpers, SSE reader
│     ├─ components/     # IssueCard, CodeEditor, SeverityBadge...
│     ├─ pages/          # Login, NewReview, History, ReviewDetail
│     ├─ store/          # Zustand stores
│     ├─ hooks/          # useStreamingReview, useAuth
│     └─ types/
├─ server/
│  └─ src/
│     ├─ routes/         # auth.ts, reviews.ts, repos.ts
│     ├─ controllers/
│     ├─ services/       # gemini.ts, review.ts, rag.ts, agent.ts
│     ├─ models/         # User, Review, Repo, Chunk
│     ├─ middleware/     # auth, errorHandler, rateLimit
│     ├─ prompts/        # review prompt templates
│     └─ utils/
├─ evals/                # seeded-bug snippets + expected issues (Polish)
├─ .gitignore            # includes .env
└─ README.md
```

---

## 10. Environment variables

Commit **only** `server/.env.example` with empty values. Real values live in the local `.env` and in Render/Vercel settings.

```
PORT=
NODE_ENV=
MONGODB_URI=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
GEMINI_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CLIENT_URL=
```

Client: `VITE_API_URL=` (no secrets in the client, ever).

---

## 11. v1 build order (Days 1–2)

**Day 1: backend**
1. New GitHub repo `codereview-ai` (old one deleted), `.gitignore` with `.env` first
2. Server setup: Express + TS, `helmet`, `cors`, `morgan`, error middleware, `/health` route
3. MongoDB connection + `User` model
4. Auth: signup, login, refresh, logout, `me` + auth middleware *(you write)*
5. `Review` model + `POST /api/reviews` without streaming first: call Gemini, return JSON *(you write)*
6. Prompt that forces JSON output + zod validation of the result *(you write)*
7. Add SSE streaming to the review route *(you write)*

**Day 2: frontend + deploy**
1. Client setup: Vite + React + TS + Tailwind + React Router + React Query + Zustand
2. Login / Sign up pages + auth flow with token refresh *(you write)*
3. New Review page + `useStreamingReview` hook reading SSE *(you write)*
4. Issue cards + severity badges + loading / error / empty states
5. History + detail pages
6. Deploy: Render (server) + Vercel (client), env vars, CORS
7. README v1 + screenshots → add to resume and portfolio

---

## 12. Rules for this build

- **You write the core logic**: auth, the review flow, prompt and parsing, streaming (server + client), React state, chunking, retrieval, the agent loop. Claude scaffolds configs and styling and reviews your code.
- Run and trace your code before asking for help (predict, then run).
- Never commit `.env`. Keys only on the server.
- Commit small and often, with clear messages.
- After each feature, explain it out loud in 2 minutes, as in an interview.

---

## 13. Interview questions this project prepares

- Why SSE and not WebSockets? How does the client read a stream?
- How do you force and validate structured output from an LLM? What if the JSON is broken?
- How did you design chunking for code? Chunk size trade-offs? How does vector search work?
- How do you control cost and latency? Caching strategy? Rate limiting algorithm?
- How do you measure if the AI review is good? (eval set)
- Where are tokens stored on the client and why? (httpOnly cookie vs localStorage)
- What happens when Gemini is slow or down? (timeouts, retries, failed status)

---

## 14. Resume bullet (fill in real numbers after Polish)

> **CodeReview AI**: AI code-review platform (React, TypeScript, Node, MongoDB Atlas Vector Search, Gemini, Redis).
> Streams severity-tagged reviews over SSE; repo-aware RAG cites related files; tool-calling agent reviews GitHub PRs.
> Caught **X%** of seeded bugs on a 20-case eval set; p95 review latency **Y s**; Redis caching cut repeat-review cost **Z%**.

---

## 15. Open decisions

- [ ] Keep the name "CodeReview AI"?
- [ ] SSE instead of Socket.io? (recommended)
- [ ] Delete the old repo and start fresh? (recommended, also removes the leaked `.env` from history)
- [ ] Monaco editor or plain textarea for v1?

## 16. Security to-do (today)

- [x] Gemini: leaked key deleted
- [ ] Create a new Gemini key → local `.env` only
- [ ] MongoDB Atlas: change the database user password
- [ ] Upstash: reset the token
- [ ] New JWT secrets (long random strings)
- [ ] Delete the old public repo
