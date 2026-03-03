import rateLimit from "express-rate-limit";

/**
 * General API limiter — applied to all /api/* routes.
 * 100 requests per 15-minute sliding window per IP.
 *
 * standardHeaders: true → sets RateLimit-* response headers (RFC 6585)
 * legacyHeaders: false → omits deprecated X-RateLimit-* headers
 * skipSuccessfulRequests: false → counts every request (intentional)
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.url === "/api/health",
  message: { success: false, message: "Too many requests — try again later" },
});

/**
 * Strict auth limiter — applied only to register / login / refresh.
 * 20 requests per 15-minute window per IP to slow brute-force attacks.
 *
 * skipSuccessfulRequests: true — only count failed attempts so legitimate
 * users who successfully log in don't consume their rate-limit budget.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts — try again later",
  },
});

/**
 * Toggle limiter — prevents XP farming by rate-limiting habit completions.
 * 60 toggles per minute per IP (generous limit for normal use).
 */
export const toggleLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many habit toggles — slow down",
  },
});

