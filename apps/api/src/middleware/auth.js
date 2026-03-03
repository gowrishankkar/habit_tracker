import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

/**
 * Express middleware: verifies the Bearer access token in the Authorization
 * header and attaches the decoded `userId` to `req.userId`.
 *
 * Short-circuits with 401 if the header is absent, malformed, or the JWT
 * signature / expiry check fails. The global errorHandler formats the response.
 */
export function authenticate(req, _res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(AppError.unauthorized("Missing or malformed Authorization header"));
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    // jwt.verify throws JsonWebTokenError / TokenExpiredError
    next(AppError.unauthorized("Invalid or expired access token"));
  }
}
