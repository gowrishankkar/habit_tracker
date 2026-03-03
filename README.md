# Habit Tracker PWA — Monorepo

Production-ready habit tracker with offline PWA support, built as an npm-workspaces monorepo.

| Layer     | Stack                                                              |
|-----------|--------------------------------------------------------------------|
| Frontend  | React 18, Vite, **JavaScript (JSX)**, Tailwind CSS, Redux Toolkit, vite-plugin-pwa |
| Backend   | Node.js 20, Express, **JavaScript (ESM)**, Mongoose, JWT, Zod     |
| Database  | MongoDB 7                                                          |
| Infra     | Docker Compose, nginx, npm workspaces                              |

---

## Project Structure

```
habit_tracker/
├── apps/
│   ├── api/                          # Express REST API (plain JS, ES modules)
│   │   ├── src/
│   │   │   ├── config/               # env validation (Zod), MongoDB connection
│   │   │   │   ├── env.js            # ← fail-fast env validation at startup
│   │   │   │   └── db.js
│   │   │   ├── middleware/
│   │   │   │   ├── auth.js           # ← JWT Bearer token verification
│   │   │   │   ├── errorHandler.js   # ← central error → JSON response
│   │   │   │   ├── rateLimiter.js    # ← brute-force protection
│   │   │   │   └── validate.js       # ← Zod schema middleware factory
│   │   │   ├── modules/              # Feature modules (clean architecture)
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.controller.js
│   │   │   │   │   ├── auth.service.js    # ← token rotation, theft detection
│   │   │   │   │   ├── auth.repository.js
│   │   │   │   │   ├── auth.routes.js
│   │   │   │   │   ├── auth.validation.js
│   │   │   │   │   └── refreshToken.model.js
│   │   │   │   ├── habits/
│   │   │   │   ├── habit-logs/
│   │   │   │   ├── badges/
│   │   │   │   └── users/
│   │   │   ├── utils/
│   │   │   │   ├── AppError.js       # ← typed operational errors
│   │   │   │   ├── apiResponse.js    # ← { success, data } envelope
│   │   │   │   └── asyncHandler.js   # ← async try/catch eliminator
│   │   │   ├── app.js               # Express setup (middleware + routes)
│   │   │   └── server.js            # Entry point (DB connect → listen)
│   │   ├── Dockerfile
│   │   └── .env.example
│   └── web/                          # React SPA (PWA)
│       ├── public/icons/             # PWA icons (192×192, 512×512)
│       ├── src/
│       │   ├── app/                  # Redux store + typed hooks
│       │   ├── components/           # Shared UI (Button, Input) + Layout
│       │   ├── features/
│       │   │   ├── auth/             # authSlice, authApi, Login/Register pages
│       │   │   └── habits/           # habitsSlice, habitsApi, HabitList/Form
│       │   └── lib/                  # fetch wrapper, route constants
│       ├── Dockerfile
│       ├── nginx.conf
│       └── vite.config.ts            # PWA + proxy config (processed by Vite/esbuild)
├── packages/
│   └── shared/                       # Constants shared across apps
│       └── src/
│           ├── constants.js          # XP values, colors, pagination limits
│           └── index.js
├── docker-compose.yml
├── .eslintrc.cjs
├── .prettierrc
└── package.json                      # Workspace root
```

---

## Architectural Decisions

### Why npm workspaces (not Turborepo / Nx)?
npm workspaces handle dependency hoisting and cross-workspace script execution
out of the box. For a two-app monorepo, adding Turborepo would introduce
configuration overhead without meaningful build-caching gains. Migrate when
the repo grows to 5+ packages.

### Why module-based backend (not MVC folders)?
Traditional MVC puts all controllers in `controllers/`, all models in `models/`,
etc. — adding a feature means editing three directories. The module-based layout
(`modules/auth/`, `modules/habits/`) co-locates every file a feature needs.
Adding a new domain = adding one folder.

### Why a Repository → Service → Controller pipeline?
- **Repository**: owns all raw Mongoose queries — swap storage backend without touching logic.
- **Service**: owns business rules (token rotation, streak logic) — callable from jobs/tests without fake HTTP objects.
- **Controller**: parses HTTP request, calls service, formats response. Zero business logic.

### Why two JWT secrets (JWT_SECRET + JWT_REFRESH_SECRET)?
If the access-token signing secret is ever leaked, an attacker could forge
access tokens but **not** refresh tokens (different secret). This limits the
blast radius of a key compromise and makes it possible to rotate access-token
keys without invalidating all user sessions.

### Why store refresh tokens in MongoDB?
Stateless JWTs cannot be revoked before expiry. Storing refresh tokens in the DB
enables:
- **Logout**: immediately revoke the specific token.
- **Token rotation**: detect reuse of a previously revoked token (theft indicator).
- **Automatic cleanup**: MongoDB TTL index deletes expired documents without a cron job.

### Why Zod for validation?
Zod validates at runtime (catching bad API payloads) while serving as the
single source of truth for input shapes. Unlike Joi, it has zero runtime
dependencies and the exact same API on frontend and backend.

### Why RTK Query instead of hand-rolled fetch?
RTK Query eliminates the loading/error/caching boilerplate entirely. Each
endpoint declaration auto-generates a hook with deduplication, cache
invalidation via tags, and re-fetch on reconnect — removing a whole class
of stale-data bugs.

### Why Helmet + rate limiting + Zod validation (defense in depth)?
Each layer catches different attack vectors:
- **Helmet**: sets CSP, HSTS, X-Frame-Options headers.
- **Rate limiting**: slows brute-force attacks on auth endpoints (20 req/15 min).
- **Zod**: rejects malformed payloads before they reach the database.

### Why vite-plugin-pwa + Workbox (not a hand-rolled service worker)?
Hand-rolling service workers is notoriously error-prone (cache busting, update
flows, precache manifests). vite-plugin-pwa wraps Workbox with sane defaults:
precaching of build assets, **NetworkFirst** runtime caching for API calls
(works offline with stale data), and a user-prompt update strategy to prevent
stale tabs.

### Why HabitLog as a separate collection (not embedded in Habit)?
A daily habit tracked for 3 years = ~1 095 completion entries. Embedding them
would bloat every dashboard read with history the UI never displays and risk
the 16 MB document cap. The tradeoff (two queries on dashboard load) is
acceptable because both queries are fully covered by compound indexes.

---

## Getting Started

### Prerequisites
- Node.js ≥ 20
- MongoDB running locally **or** Docker
- npm ≥ 10

### 1. Clone and install

```bash
git clone <repo-url> habit_tracker
cd habit_tracker
npm install
```

### 2. Configure environment

```bash
# Copy the combined example (covers API + web vars)
cp .env.example .env

# API-specific config (JWT secrets, MongoDB URI)
cp apps/api/.env.example apps/api/.env
# IMPORTANT: set real random secrets for JWT_SECRET and JWT_REFRESH_SECRET
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Web dev config
cp apps/web/.env.example apps/web/.env
```

### 3. Run in development

```bash
# Start both API + web concurrently
npm run dev

# Or individually:
npm run dev:api    # http://localhost:4000  (Node --watch, auto-restarts on save)
npm run dev:web    # http://localhost:5173  (Vite HMR, /api proxied to :4000)
```

### 4. Build for production

```bash
npm run build   # Vite production build for the web app
```

### 5. Lint and format

```bash
npm run lint          # ESLint — JS + JSX files
npm run lint:fix      # Auto-fix lint errors
npm run format        # Prettier — format all files
npm run format:check  # CI-safe format check
```

---

## Docker

### Development (MongoDB only — hot-reload locally)

```bash
docker compose up mongo
npm run dev
```

### Full production stack

```bash
# Generate real secrets
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
export JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Build and start all three containers
docker compose up --build

# App:  http://localhost
# API:  http://localhost:4000
```

### Tear down

```bash
docker compose down       # stop containers, keep volumes
docker compose down -v    # stop + delete volumes (wipes MongoDB data)
```

---

## API Reference

| Method | Endpoint                  | Auth | Description                        |
|--------|---------------------------|------|------------------------------------|
| GET    | `/api/health`             | No   | Health check                       |
| POST   | `/api/auth/register`      | No   | Create account → `{ tokens, user }`|
| POST   | `/api/auth/login`         | No   | Sign in → `{ tokens, user }`       |
| POST   | `/api/auth/refresh`       | No   | Rotate refresh token → `{ tokens }`|
| POST   | `/api/auth/logout`        | No   | Revoke refresh token               |
| GET    | `/api/users/me`           | Yes  | Current user profile               |
| GET    | `/api/habits`             | Yes  | List active habits                 |
| POST   | `/api/habits`             | Yes  | Create a habit                     |
| PATCH  | `/api/habits/:id`         | Yes  | Update a habit                     |
| DELETE | `/api/habits/:id`         | Yes  | Delete a habit                     |
| POST   | `/api/habits/:id/toggle`  | Yes  | Toggle completion for a date       |

All responses follow the envelope:
```json
{ "success": true, "data": { ... } }
{ "success": false, "message": "...", "errors": ["field: msg"] }
```

---

## Scripts Reference

| Script               | Description                                    |
|----------------------|------------------------------------------------|
| `npm run dev`        | Start API + Web in dev mode (concurrent)       |
| `npm run dev:api`    | API only — `node --watch` (Node 20 built-in)   |
| `npm run dev:web`    | Vite dev server with HMR                       |
| `npm run build`      | Vite production build                          |
| `npm run lint`       | ESLint check (JS + JSX)                        |
| `npm run lint:fix`   | Auto-fix lint errors                           |
| `npm run format`     | Prettier format all files                      |
| `npm run format:check` | CI-safe Prettier check                       |
| `npm run clean`      | Remove dist/ and node_modules/                 |
| `npm run docker:up`  | `docker compose up --build`                    |
| `npm run docker:down`| `docker compose down`                          |

Tests are scoped to the API workspace:

| Script (run from root)                        | Description                                       |
|-----------------------------------------------|---------------------------------------------------|
| `npm run test:unit --workspace=apps/api`       | Streak engine tests via `node --test`             |
| `npm run test:integration --workspace=apps/api`| API integration tests via Vitest + MongoMemServer |
| `npm run test --workspace=apps/api`            | Both suites in sequence                           |

---

## Deployment

### Overview

```
GitHub → CI (lint + tests + build)
              ↓ push to main
         Render (API)      Vercel (Web)
              ↓                  ↓
         MongoDB Atlas ←────────┘
```

### Step 1 — MongoDB Atlas

1. Create a free M0 cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. **Database Access** → Add user with `readWriteAnyDatabase` role
3. **Network Access** → Add `0.0.0.0/0` (Render uses dynamic IPs)
4. **Connect → Drivers** → copy the SRV connection string
5. Replace `<password>` and set `<dbname>` to `habit_tracker`

**Required indexes** (the app creates these via `mongoose.model()` definitions,
but run this to verify after first deploy):
```js
// habits collection — most-used query patterns
db.habits.createIndex({ userId: 1, archived: 1 })
db.habits.createIndex({ userId: 1, category: 1 })
// habitleogs collection — streak engine date queries
db.habitleogs.createIndex({ habitId: 1, dateKey: 1 }, { unique: true })
db.habitleogs.createIndex({ userId: 1, dateKey: 1 })
```

### Step 2 — Backend on Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New → Blueprint**
3. Connect your GitHub repo — Render auto-detects `render.yaml`
4. In **Environment** tab, set the secrets:

   | Key | Value |
   |-----|-------|
   | `MONGO_URI` | Atlas SRV string from Step 1 |
   | `JWT_SECRET` | `openssl rand -hex 32` |
   | `JWT_REFRESH_SECRET` | `openssl rand -hex 32` (different) |
   | `CORS_ORIGIN` | Your Vercel URL (fill in after Step 3) |

5. Deploy — Render runs `npm ci` then `node apps/api/src/server.js`
6. Note your service URL: `https://habit-tracker-api.onrender.com`

> **Render free tier caveat**: free services spin down after 15 min of
> inactivity and take ~30 s to cold-start. Upgrade to Starter ($7/mo) for
> always-on, or use a cron service to ping `/api/health` every 10 min.

### Step 3 — Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → import repo
2. Set **Root Directory** to `apps/web` (or use the root with framework override)
3. Set **Build Command**: `npm run build --workspace=@habit-tracker/web`
4. Set **Output Directory**: `apps/web/dist`
5. Add Environment Variable:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://habit-tracker-api.onrender.com/api` |

6. Deploy — Vercel uses `vercel.json` at the repo root for routing rules
7. Copy your Vercel URL and update `CORS_ORIGIN` in Render (Step 2, point 4)

### Step 4 — CI/CD (GitHub Actions)

Run this once from `apps/web/` to get the Vercel project IDs:
```bash
npx vercel link
cat .vercel/project.json   # → orgId, projectId
```

Add these **repository secrets** in GitHub → Settings → Secrets:

| Secret | Value |
|--------|-------|
| `RENDER_DEPLOY_HOOK_URL` | Render → Service → Settings → Deploy Hooks |
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens |
| `VERCEL_ORG_ID` | from `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | from `.vercel/project.json` |
| `VITE_API_URL` | `https://habit-tracker-api.onrender.com/api` |

**Pipeline on every PR**:
1. ESLint + Prettier check
2. Streak engine unit tests (`node --test`)
3. API integration tests (Vitest + MongoMemoryServer — no real DB needed)
4. Vite production build verification

**Pipeline on push to `main`** (after CI passes):
1. Trigger Render deploy via deploy hook
2. Poll `/api/health` until healthy (max 90 s)
3. Deploy to Vercel (`vercel deploy --prod`)
4. Smoke test both endpoints

### Environment Variables Reference

| Variable | Where to set | Description |
|----------|-------------|-------------|
| `MONGO_URI` | Render | Atlas SRV connection string |
| `JWT_SECRET` | Render | 64-char random hex string |
| `JWT_REFRESH_SECRET` | Render | 64-char random hex string (different) |
| `JWT_ACCESS_EXPIRES_IN` | Render | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Render | `7d` |
| `CORS_ORIGIN` | Render | Vercel deployment URL |
| `NODE_ENV` | Render | `production` |
| `VITE_API_URL` | Vercel | Render service URL + `/api` |

---

## Build Optimisation

### Bundle splitting strategy

Vite splits the output into four chunks:

| Chunk | Libraries | Why separate |
|-------|-----------|-------------|
| `react-vendor` | React 18 + ReactDOM | ~140 KB gz — changes only on React upgrades |
| `redux-vendor` | RTK + React-Redux | ~50 KB gz — changes only on Redux upgrades |
| `charts-vendor` | Recharts + D3 | ~80 KB gz — analytics page only; don't load on first paint |
| `index` | Your app code | Changes on every deploy |

Result: after the first visit, only the `index` chunk re-downloads when you
ship new features. The vendor chunks stay in the browser cache indefinitely
(they have content-hash filenames and `Cache-Control: immutable` headers).

### Caching layers

```
Browser cache (immutable, 1 year)
  └─ /assets/*.js, /assets/*.css, /assets/*.woff2

Vercel CDN edge cache (30 days)
  └─ /icons/*, images

No cache (always fresh)
  └─ /index.html, /sw.js, /manifest.webmanifest
```

The service worker adds a third layer: `CacheFirst` for the app shell,
`NetworkFirst` for `/api/habits`, `StaleWhileRevalidate` for `/api/analytics`.

---

## Monitoring

### Application health
- **Render** → service dashboard shows CPU, memory, response times
- **Render** → `/api/health` is polled every 30 s; unhealthy = automatic redeploy

### Logs
- **Development**: Winston colorized console output
- **Production**: JSON structured logs → Render log stream
  - Connect Render log drain to **Logtail** (free tier) or **Papertrail** for
    persistent searchable logs and alerts
- Every HTTP request log includes the `X-Request-ID` header so you can
  correlate a user's error report to server-side logs

### Error tracking (recommended)
```bash
# Add to apps/web and apps/api
npm install @sentry/react @sentry/node --workspace=apps/web --workspace=apps/api
```
Sentry captures unhandled exceptions with full stack traces and source-map
de-obfuscation (the build emits `hidden` source maps for exactly this purpose).

### Alerting
Set up uptime monitors in:
- **Better Uptime** or **UptimeRobot** (free) → ping `/api/health` every 5 min
- Alert on `status != 200` or response time > 2 s

---

## Scaling Considerations & Bottlenecks

### Current bottlenecks

| Bottleneck | Why it matters | Mitigation |
|------------|---------------|------------|
| **Render cold starts** | Free tier spins down after 15 min → 30 s first request | Upgrade to Starter, or health-check cron |
| **MongoDB Atlas M0** | 512 MB storage, shared vCPU, no dedicated RAM | Upgrade to M10+ at ~500 DAU |
| **Single API instance** | No horizontal scaling on Render Starter | Render scales to multiple instances on Standard plan |
| **JWT token refresh** | Every client retries refresh on 401 — thundering herd after a deploy | Stagger token expiry; use exponential backoff in `authApi.js` |
| **Streak recalculation** | `recalculateStreak` scans all completion history on every toggle | Already bounded by TTL index; add Redis cache if P99 > 100 ms |
| **Analytics aggregation** | MongoDB `$group` on large collections is expensive | Cache pipeline results in a materialized view or Redis for 10 min |

### When to scale up

| Metric | Action |
|--------|--------|
| API P99 latency > 500 ms | Add Render autoscaling (Standard plan) |
| MongoDB CPU > 70% | Upgrade Atlas tier; add read replicas |
| 429 rate limit errors in logs | Tune `apiLimiter.max` (currently 100/15 min) |
| Bundle size > 500 KB gz | Lazy-load analytics routes; use `React.lazy()` |

### Horizontal scaling readiness

The API is stateless — JWT verification needs no shared session store. Rate
limiting uses in-memory counters per instance. When you run 2+ instances:
- **Rate limiting becomes per-instance** (a user can send 2× requests if load-balanced across 2 instances). Migrate `express-rate-limit` to `rate-limit-redis` with a shared Redis store to fix this.
- **Background Sync replay** is idempotent (the toggle endpoint checks for existing completions), so duplicate replays from different instances are safe.


