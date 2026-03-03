import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { toggleLimiter } from "../../middleware/rateLimiter.js";
import {
  createHabitSchema,
  updateHabitSchema,
  toggleCompletionSchema,
} from "./habit.validation.js";
import * as habitController from "./habit.controller.js";

const router = Router();

// All habit routes require a valid access token
router.use(authenticate);

router.get("/", habitController.list);
router.post("/", validate(createHabitSchema), habitController.create);
router.patch("/:id", validate(updateHabitSchema), habitController.update);
router.delete("/:id", habitController.remove);
router.post(
  "/:id/toggle",
  toggleLimiter,
  validate(toggleCompletionSchema),
  habitController.toggleCompletion,
);

export default router;
