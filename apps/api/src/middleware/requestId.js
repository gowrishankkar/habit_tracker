/**
 * requestId middleware
 *
 * Attaches a unique request ID to every incoming HTTP request.
 * - Reads X-Request-ID from client headers if present (forwarded from Vercel/CDN)
 * - Otherwise generates a fresh ID using crypto.randomUUID()
 *
 * The ID is stored on req.id and echoed back in the X-Request-ID response
 * header so the client can correlate errors with server-side logs.
 *
 * Usage: mount BEFORE logger middleware so every log entry carries the ID.
 */

import { randomUUID } from "crypto";

export function requestId(req, res, next) {
  const id = req.headers["x-request-id"] ?? randomUUID();
  req.id = id;
  res.setHeader("X-Request-ID", id);
  next();
}
