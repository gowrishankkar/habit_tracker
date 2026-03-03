import { sendError } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Central Express error handler (must be registered LAST).
 *
 * Priority order:
 *   1. AppError (operational) → use its statusCode + message
 *   2. Mongoose E11000 duplicate key → 409 Conflict
 *   3. Mongoose ValidationError → 422 Unprocessable Entity
 *   4. Mongoose CastError (bad ObjectId) → 400 Bad Request
 *   5. JWT errors → 401 Unauthorized
 *   6. Everything else → log + 500 (hide details in prod)
 */
export function errorHandler(err, req, res, _next) {
  // Build a log context object shared by all branches
  const ctx = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?._id,
  };

  // 1. Known operational AppError
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error("Non-operational AppError", { ...ctx, stack: err.stack });
    } else if (err.statusCode >= 500) {
      logger.error(err.message, { ...ctx, stack: err.stack });
    } else {
      logger.warn(err.message, { ...ctx, statusCode: err.statusCode });
    }
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  // 2. Mongoose E11000 duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {}).join(", ") || "field";
    logger.warn("Duplicate key violation", { ...ctx, field });
    sendError(res, `A resource with that ${field} already exists`, 409);
    return;
  }

  // 3. Mongoose ValidationError
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    logger.warn("Mongoose validation error", { ...ctx, errors });
    sendError(res, "Validation failed", 422, errors);
    return;
  }

  // 4. Mongoose CastError (e.g., invalid ObjectId in URL param)
  if (err.name === "CastError") {
    logger.warn("CastError: invalid document id", { ...ctx, value: err.value });
    sendError(res, "Invalid resource identifier", 400);
    return;
  }

  // 5. JWT errors
  if (err.name === "JsonWebTokenError") {
    logger.warn("Invalid JWT", ctx);
    sendError(res, "Invalid token", 401);
    return;
  }
  if (err.name === "TokenExpiredError") {
    logger.warn("Expired JWT", ctx);
    sendError(res, "Token expired", 401);
    return;
  }

  // 6. Unhandled — log full stack, never expose internals in production
  logger.error("Unhandled error", { ...ctx, stack: err.stack ?? err.message });
  const message =
    env.NODE_ENV === "production" ? "Internal server error" : err.message;
  sendError(res, message, 500);
}

