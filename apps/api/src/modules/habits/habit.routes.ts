import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createHabitSchema,
  updateHabitSchema,
  toggleCompletionSchema,
} from "./habit.validation.js";
import * as habitController from "./habit.controller.js";

const router = Router();

// All habit routes require authentication
router.use(authenticate);

router.get("/", habitController.list);
router.post("/", validate(createHabitSchema), habitController.create);
router.patch("/:id", validate(updateHabitSchema), habitController.update);
router.delete("/:id", habitController.remove);
router.post(
  "/:id/toggle",
  validate(toggleCompletionSchema),
  habitController.toggleCompletion,
);

export default router;
