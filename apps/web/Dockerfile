FROM node:20-alpine AS base
WORKDIR /app

# ── Install dependencies ──────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm ci \
  --workspace=@habit-tracker/web \
  --workspace=@habit-tracker/shared \
  --include-workspace-root

# ── Build ─────────────────────────────────────────────
# Vite transpiles JSX and bundles the app — no TypeScript compile step needed.
FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace=@habit-tracker/web

# ── Serve with nginx ──────────────────────────────────
FROM nginx:alpine AS production
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
