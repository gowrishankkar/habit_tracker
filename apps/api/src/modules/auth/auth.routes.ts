import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { authLimiter } from "../../middleware/rateLimiter.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from "./auth.validation.js";
import * as authController from "./auth.controller.js";

const router = Router();

router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  authController.register,
);

router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  authController.login,
);

router.post(
  "/refresh",
  authLimiter,
  validate(refreshSchema),
  authController.refresh,
);

router.post(
  "/logout",
  validate(logoutSchema),
  authController.logout,
);

export default router;
