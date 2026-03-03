import { sendSuccess, sendError } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as habitService from "./habit.service.js";

export const list = asyncHandler(async (req, res) => {
  const habits = await habitService.list(req.userId);
  sendSuccess(res, habits);
});

export const create = asyncHandler(async (req, res) => {
  const habit = await habitService.create(req.userId, req.body);
  sendSuccess(res, habit, 201);
});

export const update = asyncHandler(async (req, res) => {
  const habit = await habitService.update(req.params.id, req.userId, req.body);
  if (!habit) {
    sendError(res, "Habit not found", 404);
    return;
  }
  sendSuccess(res, habit);
});

export const remove = asyncHandler(async (req, res) => {
  const habit = await habitService.remove(req.params.id, req.userId);
  if (!habit) {
    sendError(res, "Habit not found", 404);
    return;
  }
  sendSuccess(res, { deleted: true });
});

export const toggleCompletion = asyncHandler(async (req, res) => {
  // `date`  — the day being toggled, in the user's LOCAL timezone ("YYYY-MM-DD")
  // `today` — the user's current local date; drives streak-active check.
  //           Falls back to `date` for simple clients / tests that omit it.
  const { date: dateKey, today: todayKey = req.body.date } = req.body;
  const gracePeriods = req.user?.gracePeriods ?? 0;

  const result = await habitService.toggleCompletion(
    req.params.id,
    req.userId,
    dateKey,
    todayKey,
    gracePeriods,
  );
  if (!result) {
    sendError(res, "Habit not found", 404);
    return;
  }
  // result = { habit, gamification }
  sendSuccess(res, result);
});
