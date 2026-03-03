import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import app from "./app.js";
import { logger } from "./utils/logger.js";

/**
 * Graceful shutdown — closes the HTTP server, then exits.
 * Ensures in-flight requests complete (up to 10 s) before the process dies.
 */
function gracefulShutdown(server, signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });

  // Force-kill if the server hasn't closed within 10 seconds
  setTimeout(() => {
    logger.error("Forcing shutdown — server did not close in time");
    process.exit(1);
  }, 10_000).unref();
}

async function bootstrap() {
  // ── Process-level safety nets ─────────────────────────────────────────────
  // These catch programming errors that slipped past try/catch.
  // Log them at the error level and exit — running in an unknown state is
  // worse than restarting (use a process manager like PM2 to auto-restart).

  process.on("uncaughtException", (err) => {
    logger.error("uncaughtException — process will exit", {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("unhandledRejection — process will exit", {
      reason: reason instanceof Error ? reason.stack : String(reason),
    });
    process.exit(1);
  });

  await connectDB();

  const server = app.listen(env.API_PORT, () => {
    logger.info(
      `API running on http://localhost:${env.API_PORT} (${env.NODE_ENV})`,
    );
  });

  // Gracefully stop on standard POSIX signals
  process.on("SIGTERM", () => gracefulShutdown(server, "SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown(server, "SIGINT"));
}

bootstrap();

