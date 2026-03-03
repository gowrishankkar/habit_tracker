/**
 * setup-deployment.cjs
 * Run: node setup-deployment.cjs
 *
 * Creates all CI/CD files and updates env.example for production.
 * All content is inlined here so no shell access is needed.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

function write(relPath, content) {
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  console.log("✓", relPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// .github/workflows/ci.yml
// Runs on every PR and push to main: lint → unit tests → integration tests
// ─────────────────────────────────────────────────────────────────────────────

write(".github/workflows/ci.yml", `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

# Cancel any in-progress run for the same branch/PR to save CI minutes
concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ── Lint + Format check ─────────────────────────────────────────────────────
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: ESLint
        run: npm run lint

      - name: Prettier check
        run: npm run format:check

  # ── Streak engine unit tests (node:test, zero deps) ─────────────────────────
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install API dependencies
        run: npm ci --workspace=@habit-tracker/api --workspace=@habit-tracker/shared --include-workspace-root

      - name: Run streak engine tests
        run: npm run test:unit --workspace=@habit-tracker/api

  # ── API integration tests (vitest + MongoMemoryServer) ──────────────────────
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install API dependencies
        run: npm ci --workspace=@habit-tracker/api --workspace=@habit-tracker/shared --include-workspace-root

      - name: Run integration tests
        run: npm run test:integration --workspace=@habit-tracker/api
        env:
          NODE_ENV: test
          # Dummy secrets — real values never leave production environment.
          # MongoMemoryServer overrides MONGO_URI at runtime.
          MONGO_URI: mongodb://localhost:27017/test
          JWT_SECRET: ci-test-jwt-secret-at-least-16chars
          JWT_REFRESH_SECRET: ci-test-refresh-secret-minimum-16chars

  # ── Frontend build check ─────────────────────────────────────────────────────
  build-web:
    name: Frontend Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install web dependencies
        run: npm ci --workspace=@habit-tracker/web --workspace=@habit-tracker/shared --include-workspace-root

      - name: Vite build
        run: npm run build --workspace=@habit-tracker/web
        env:
          # Placeholder — real URL injected at Vercel deploy time
          VITE_API_URL: https://habit-tracker-api.onrender.com/api

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: web-dist
          path: apps/web/dist
          retention-days: 7
`);

// ─────────────────────────────────────────────────────────────────────────────
// .github/workflows/deploy.yml
// Triggers on push to main AFTER CI passes — deploys to Render + Vercel
// ─────────────────────────────────────────────────────────────────────────────

write(".github/workflows/deploy.yml", `name: Deploy

on:
  # Only deploy when CI passes on the main branch
  workflow_run:
    workflows: [CI]
    branches: [main]
    types: [completed]

jobs:
  # ── Deploy backend to Render ─────────────────────────────────────────────────
  # Render auto-deploys via the render.yaml Blueprint when you push to main.
  # This job explicitly triggers a deploy via the Render API so the pipeline
  # is visible in GitHub (instead of happening silently in the background).
  deploy-api:
    name: Deploy API → Render
    runs-on: ubuntu-latest
    if: \${{ github.event.workflow_run.conclusion == 'success' }}
    steps:
      - name: Trigger Render deploy
        # RENDER_DEPLOY_HOOK_URL is set in repo secrets:
        #   Render → Service → Settings → Deploy Hooks → Create Hook
        run: |
          curl --silent --fail -X POST "\${{ secrets.RENDER_DEPLOY_HOOK_URL }}"
          echo "Render deploy triggered"

      - name: Wait for Render health check
        run: |
          echo "Waiting 90s for Render to build and start..."
          sleep 90
          STATUS=$(curl --silent --fail -o /dev/null -w "%{http_code}" \\
            https://habit-tracker-api.onrender.com/api/health || echo "000")
          echo "Health check status: \$STATUS"
          if [ "\$STATUS" != "200" ]; then
            echo "❌ Health check failed"
            exit 1
          fi
          echo "✅ API is healthy"

  # ── Deploy frontend to Vercel ─────────────────────────────────────────────────
  # Vercel also auto-deploys from GitHub, but having an explicit job lets us
  # run the deploy only after the backend is healthy.
  deploy-web:
    name: Deploy Web → Vercel
    runs-on: ubuntu-latest
    needs: deploy-api
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install Vercel CLI
        run: npm install -g vercel@latest

      - name: Install dependencies
        run: npm ci --workspace=@habit-tracker/web --workspace=@habit-tracker/shared --include-workspace-root

      - name: Deploy to Vercel (production)
        # VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID set in repo secrets.
        # Get them from: vercel link (in apps/web), then .vercel/project.json
        run: |
          vercel pull --yes --environment=production \\
            --token=\${{ secrets.VERCEL_TOKEN }}
          vercel build --prod \\
            --token=\${{ secrets.VERCEL_TOKEN }}
          vercel deploy --prebuilt --prod \\
            --token=\${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/web
        env:
          VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}
          VITE_API_URL: \${{ secrets.VITE_API_URL }}

  # ── Post-deploy smoke test ─────────────────────────────────────────────────
  smoke-test:
    name: Smoke Test
    runs-on: ubuntu-latest
    needs: [deploy-api, deploy-web]
    steps:
      - name: API health check
        run: |
          curl --silent --fail https://habit-tracker-api.onrender.com/api/health

      - name: Frontend reachable
        run: |
          STATUS=$(curl --silent -o /dev/null -w "%{http_code}" \\
            https://habit-tracker.vercel.app)
          echo "Frontend HTTP status: \$STATUS"
          [ "\$STATUS" = "200" ]
`);

// ─────────────────────────────────────────────────────────────────────────────
// .env.production.example
// Documents every env var needed for production deployments.
// Never commit real values — this is documentation only.
// ─────────────────────────────────────────────────────────────────────────────

write(".env.production.example", `# ════════════════════════════════════════════════════════════════════════
#  PRODUCTION ENVIRONMENT VARIABLES
#  Set all of these in Render dashboard and Vercel dashboard.
#  NEVER commit real values to git.
# ════════════════════════════════════════════════════════════════════════

# ── Backend (set in Render → Environment) ────────────────────────────────
NODE_ENV=production

# MongoDB Atlas SRV connection string (from Atlas → Connect → Drivers)
# Replace <username>, <password>, <cluster-url>, <dbname>
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/<dbname>?retryWrites=true&w=majority&appName=HabitTracker

# JWT secrets — generate with: openssl rand -hex 32
JWT_SECRET=<64-hex-chars>
JWT_REFRESH_SECRET=<64-hex-chars-different-from-above>

# Token lifetimes
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Vercel deployment URL (no trailing slash)
CORS_ORIGIN=https://habit-tracker.vercel.app

# Render assigns PORT automatically — no need to set this manually
# API_PORT=4000

# ── Frontend (set in Vercel → Project Settings → Environment Variables) ──
# Your Render service URL (no trailing slash)
VITE_API_URL=https://habit-tracker-api.onrender.com/api

# ── GitHub Actions Secrets (set in repo Settings → Secrets) ──────────────
# RENDER_DEPLOY_HOOK_URL  — from Render → Service → Settings → Deploy Hooks
# VERCEL_TOKEN            — from vercel.com → Account Settings → Tokens
# VERCEL_ORG_ID           — from .vercel/project.json after \`vercel link\`
# VERCEL_PROJECT_ID       — from .vercel/project.json after \`vercel link\`
# VITE_API_URL            — same as above (needed during Vercel CLI build)
`);

console.log("\n✅  Deployment files created.\n");
console.log("Next steps:");
console.log("  See README.md → Deployment section for full walkthrough.");
`);

// ─────────────────────────────────────────────────────────────────────────────
// Request ID middleware (for distributed tracing)
// ─────────────────────────────────────────────────────────────────────────────

write("apps/api/src/middleware/requestId.js", `/**
 * requestId middleware
 *
 * Attaches a unique request ID to every incoming HTTP request.
 * - Reads X-Request-ID from client headers if present (forwarded from Vercel/CDN)
 * - Otherwise generates a fresh ID using crypto.randomUUID()
 *
 * The ID is stored on req.id and echoed back in the X-Request-ID response
 * header so the client can correlate errors with server logs.
 *
 * Usage: attach BEFORE logger middleware so every log entry carries the ID.
 */

import { randomUUID } from "crypto";

export function requestId(req, res, next) {
  const id = req.headers["x-request-id"] ?? randomUUID();
  req.id = id;
  res.setHeader("X-Request-ID", id);
  next();
}
`);

console.log("\n✅  All deployment files created.\n");
console.log("Next steps:");
console.log("  node setup-deployment.cjs");
console.log("  Then see README.md for full deployment walkthrough.");
