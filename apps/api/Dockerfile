FROM node:20-alpine AS base
WORKDIR /app

# ── Install dependencies ──────────────────────────────
# Copy only package manifests first so Docker can cache the npm ci layer.
# The source is copied later — a source change won't re-run npm ci.
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm ci \
  --workspace=@habit-tracker/api \
  --workspace=@habit-tracker/shared \
  --include-workspace-root

# ── Production image ──────────────────────────────────
# No build step needed — the API runs plain JavaScript directly.
FROM base AS production
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY package.json ./

EXPOSE 4000
CMD ["node", "apps/api/src/server.js"]
