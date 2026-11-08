# CodeReview AI: Interview Notes

One section per build step: what we built, why the product needs it, how it works, trade-offs, and interview questions with my answers.

## Quiz backlog (to do after v1 is deployed)

Questions I skipped while building. Answer them in each step's section below, then tick them here.

- [ ] Step 2: What is middleware, and why does the order of `app.use` matter?
- [ ] Step 2: A route throws an error. What happens until the client gets a response? Why hide 500 messages in production?
- [ ] Step 2: What does CORS protect against? Can curl still call our API?

---

## Step 2: Server setup and `/health`

### What we built
An Express + TypeScript server with security headers (helmet), CORS, request logging (morgan), JSON body parsing with a size limit, cookie parsing, a 404 handler, a central error handler and a `GET /health` route.

### Business reason
Every feature (auth, reviews, history) is an HTTP route, so they all need one safe, consistent base to plug into.
- **Users** get predictable errors (always `{ "error": "..." }` JSON) that the React app can show.
- **Security:** users paste private code, so the API must not leak stack traces, must only accept requests from our frontend, and must reject huge bodies.
- **`/health`** lets Render (the host) and uptime monitors check the server is alive and restart it if not. It has no business logic, so it's cheap to call.

### How it works
**Files:** `src/index.ts` starts the server, `src/app.ts` builds the app, `src/routes/health.ts`, `src/middleware/errorHandler.ts`.

**Why `app.ts` and `index.ts` are separate:** `createApp()` builds the app without starting it, so tests can import it and send fake requests without opening a real port. `index.ts` loads `.env` (`import "dotenv/config"` must come first) and calls `listen`.

**Request flow** — middleware runs top to bottom, in the order of `app.use`:
```
request
 → helmet         adds security headers (CSP, HSTS, hides X-Powered-By)
 → cors           adds Access-Control-Allow-Origin: CLIENT_URL (+ credentials for cookies)
 → morgan         logs "GET /health 200 3ms"
 → express.json   parses JSON body into req.body; bad JSON → 400, >100kb → 413
 → cookieParser   parses cookies into req.cookies (refresh token later)
 → /health route  sends { status, uptime, timestamp }
 → notFound       nothing matched → creates a 404 error
 → errorHandler   turns any error into { error } JSON with the right status
```
- A middleware either **ends** the request (sends a response) or calls `next()` to pass it on. `next(err)` skips straight to the error handler.
- Express knows `errorHandler` is an error handler because it takes **4 arguments** `(err, req, res, next)`.
- **Express 5** forwards errors thrown inside `async` routes to the error handler automatically. In Express 4 you needed `try/catch` + `next(err)` or a wrapper.
- `HttpError(status, message)`: routes `throw new HttpError(404, "Review not found")` and the error handler sends that status.
- In production, 5xx messages become `"Internal server error"` so internals don't leak. 4xx messages are shown because they're the client's fault and safe to explain.

**Tested with curl:** `/health` → 200 · unknown route → 404 · broken JSON → 400 · body over 100kb → 413 · CORS header only allows `CLIENT_URL`.
**Gotcha:** on macOS, port 5000 is AirPlay Receiver, so requests got 403 from Apple's server, not ours. We use port 4000.

### Trade-offs
| We chose | Alternative | Why |
|---|---|---|
| Express | Fastify, NestJS | Most widely known, huge ecosystem, simple. Fastify is faster; Nest adds structure but much boilerplate. Speed isn't our bottleneck — Gemini is. |
| TypeScript | Plain JS | Same types as the React app, catches bugs at build time. Costs a build step (`tsc`) and `tsx` in dev. |
| Central error handler | try/catch + `res.status` in every route | One place decides the error format and hides internals. Routes stay short. |
| CORS allow-list (one origin) | `cors()` allowing every origin | We send cookies (`credentials: true`), and browsers forbid `*` with credentials anyway. Only our frontend should call the API. |
| 100kb JSON limit | Default (100kb) or bigger | Code input is ~20 KB max in v1, so 100kb is plenty and blocks huge-payload abuse. |

**Note:** CORS is a **browser** rule. It doesn't stop curl or another server calling the API; auth and rate limits do that.

### Interview questions and my answers
1. **What is middleware in Express, and why does the order of `app.use` matter?**
   _My answer:_ (pending)
2. **A route throws an error. Walk me through what happens until the client gets a response, and why we hide 500 messages in production.**
   _My answer:_ (pending)
3. **What does CORS protect against? If CORS only allows our frontend, can someone still call our API with curl?**
   _My answer:_ (pending)
