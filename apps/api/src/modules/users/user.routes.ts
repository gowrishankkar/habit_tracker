import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as userController from "./user.controller.js";

const router = Router();

router.get("/me", authenticate, userController.getMe);

export default router;
