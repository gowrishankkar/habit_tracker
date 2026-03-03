import { Router } from "express";
import { authLimiter } from "../../middleware/rateLimiter.js";
import { validate } from "../../middleware/validate.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from "./auth.validation.js";
import * as authController from "./auth.controller.js";

const router = Router();

/**
 * POST /api/auth/register
 * Rate-limited + validated. Returns { tokens, user } on success.
 */
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  authController.register,
);

/**
 * POST /api/auth/login
 * Rate-limited + validated. Returns { tokens, user } on success.
 */
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  authController.login,
);

/**
 * POST /api/auth/refresh
 * Rotate the refresh token. Returns a fresh { tokens } pair.
 * Rate-limited to prevent refresh-token brute-force.
 */
router.post(
  "/refresh",
  authLimiter,
  validate(refreshSchema),
  authController.refresh,
);

/**
 * POST /api/auth/logout
 * Revokes the supplied refresh token (single-device logout).
 */
router.post("/logout", validate(logoutSchema), authController.logout);

export default router;
