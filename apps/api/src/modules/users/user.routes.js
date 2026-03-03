import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as userController from "./user.controller.js";

const router = Router();

// GET /api/users/me — returns the current user's public profile
router.get("/me", authenticate, userController.getMe);

export default router;
