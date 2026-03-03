import type { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";
import * as habitService from "./habit.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  const habits = await habitService.list(req.userId!);
  sendSuccess(res, habits);
}

export async function create(req: Request, res: Response): Promise<void> {
  const habit = await habitService.create(req.userId!, req.body);
  sendSuccess(res, habit, 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const habit = await habitService.update(req.params.id, req.userId!, req.body);
  if (!habit) {
    sendError(res, "Habit not found", 404);
    return;
  }
  sendSuccess(res, habit);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const habit = await habitService.remove(req.params.id, req.userId!);
  if (!habit) {
    sendError(res, "Habit not found", 404);
    return;
  }
  sendSuccess(res, { deleted: true });
}

export async function toggleCompletion(
  req: Request,
  res: Response,
): Promise<void> {
  const habit = await habitService.toggleCompletion(
    req.params.id,
    req.userId!,
    req.body.date,
  );
  if (!habit) {
    sendError(res, "Habit not found", 404);
    return;
  }
  sendSuccess(res, habit);
}
