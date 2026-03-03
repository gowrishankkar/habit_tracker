import { z } from "zod";
import { HABIT_NAME_MAX_LENGTH, HABIT_COLORS } from "@habit-tracker/shared";

export const createHabitSchema = z.object({
  name: z.string().min(1).max(HABIT_NAME_MAX_LENGTH),
  description: z.string().max(500).optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default(HABIT_COLORS[4]),
});

export const updateHabitSchema = z.object({
  name: z.string().min(1).max(HABIT_NAME_MAX_LENGTH).optional(),
  description: z.string().max(500).optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const toggleCompletionSchema = z.object({
  date: z.string().datetime({ message: "Must be an ISO 8601 date string" }),
});
