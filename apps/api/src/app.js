import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import { env } from "./config/env.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestId } from "./middleware/requestId.js";
import { AppError } from "./utils/AppError.js";
import { logger, morganStream } from "./utils/logger.js";

import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import habitRoutes from "./modules/habits/habit.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";

const app = express();

// ── Request ID ───────────────────────────────────────────────────────────────
// Must be FIRST so every subsequent middleware and log entry carries the ID.
app.use(requestId);

// ── Security headers (Helmet) ────────────────────────────────────────────────
// Each directive is explicitly configured so security decisions are visible.
app.use(
  helmet({
    // Content Security Policy — tight in production, relaxed in dev for HMR
    contentSecurityPolicy:
      env.NODE_ENV === "production"
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind inline styles
              imgSrc: ["'self'", "data:", "https:"],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false, // disabled in dev to allow Vite HMR websocket

    // HTTP Strict Transport Security — only meaningful in production (HTTPS)
    hsts:
      env.NODE_ENV === "production"
        ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } // 2 years
        : false,

    // Prevent browsers from MIME-sniffing a response away from the declared type
    noSniff: true,

    // Prevent clickjacking by disallowing the app inside iframes
    frameguard: { action: "deny" },

    // Remove the X-Powered-By: Express header (reduces fingerprinting surface)
    hidePoweredBy: true,

    // Block IE from opening responses in the context of your site
    ieNoOpen: true,

    // Force browser's built-in XSS filter (defense in depth, not a primary control)
    xssFilter: true,

    // Referrer policy — only send origin on same-origin requests
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },

    // Cross-Origin policies
    crossOriginEmbedderPolicy: false, // would break third-party resources
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-site" },
  }),
);

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = env.CORS_ORIGIN
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (curl/Postman) that do not send Origin.
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/+$/, "");
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ── HTTP request logging ─────────────────────────────────────────────────────
// Define a custom 'combined-with-id' format that prepends the request ID.
// This lets you grep logs by request ID to see all entries for one request.
morgan.token("id", (req) => req.id);

if (env.NODE_ENV !== "test") {
  const morganFormat =
    env.NODE_ENV === "production"
      ? ":id :remote-addr - :remote-user [:date[clf]] \":method :url HTTP/:http-version\" :status :res[content-length] \":referrer\" \":user-agent\""
      : ":id :method :url :status :response-time ms";

  app.use(morgan(morganFormat, {
    stream: morganStream,
    // Skip logging health checks to avoid noise
    skip: (req) => req.url === "/api/health",
  }));
}

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Input sanitization ───────────────────────────────────────────────────────
// mongoSanitize: strips keys containing '$' or '.' from req.body / req.query
// to prevent NoSQL injection attacks like { "email": { "$gt": "" } }.
app.use(
  mongoSanitize({
    onSanitize: ({ req, key }) => {
      logger.warn("MongoDB injection attempt sanitized", {
        ip: req.ip,
        key,
        url: req.url,
      });
    },
  }),
);

// hpp: HTTP Parameter Pollution — when a param appears multiple times,
// use only the last value (prevents array-based injection on query params).
app.use(hpp());

// ── Global rate limiting ─────────────────────────────────────────────────────
app.use("/api", apiLimiter);

// ── Health check (unauthenticated, not rate-limited) ─────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Feature routes ───────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/habits", habitRoutes);
app.use("/api/analytics", analyticsRoutes);

// ── 404 handler ──────────────────────────────────────────────────────────────
// Must come after all routes so it only fires for unmatched paths.
app.use((req, _res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.url}`));
});

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

export default app;

