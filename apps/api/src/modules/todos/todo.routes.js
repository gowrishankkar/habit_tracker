import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { createTodoSchema, updateTodoSchema } from "./todo.validation.js";
import * as todoController from "./todo.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", todoController.list);
router.post("/", validate(createTodoSchema), todoController.create);
router.delete("/completed", todoController.clearCompleted);
router.patch("/:id/toggle", todoController.toggle);
router.patch("/:id", validate(updateTodoSchema), todoController.update);
router.delete("/:id", todoController.remove);

export default router;
