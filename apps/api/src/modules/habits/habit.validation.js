import { z } from "zod";
import { HABIT_TITLE_MAX_LENGTH, HABIT_COLORS } from "@habit-tracker/shared";

export const createHabitSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(HABIT_TITLE_MAX_LENGTH, `Title must be ${HABIT_TITLE_MAX_LENGTH} chars or less`)
    .trim(),
  description: z.string().max(500).trim().optional(),
  category: z
    .enum([
      "health",
      "fitness",
      "mindfulness",
      "learning",
      "productivity",
      "social",
      "finance",
      "creativity",
      "other",
    ])
    .default("other"),
  frequency: z.enum(["daily", "weekly", "custom"]).default("daily"),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]).default("medium"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #3b82f6")
    .default(HABIT_COLORS[4]),
  xpValue: z.coerce.number().min(1).default(10),
  targetDays: z.array(z.number().min(0).max(6)).default([]),
});

export const updateHabitSchema = z.object({
  title: z.string().min(1).max(HABIT_TITLE_MAX_LENGTH).trim().optional(),
  description: z.string().max(500).trim().optional(),
  category: z
    .enum([
      "health",
      "fitness",
      "mindfulness",
      "learning",
      "productivity",
      "social",
      "finance",
      "creativity",
      "other",
    ])
    .optional(),
  frequency: z.enum(["daily", "weekly", "custom"]).optional(),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  xpValue: z.coerce.number().min(1).optional(),
  targetDays: z.array(z.number().min(0).max(6)).optional(),
  archived: z.boolean().optional(),
});

// The toggle endpoint accepts a YYYY-MM-DD date key
export const toggleCompletionSchema = z.object({
  date: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must be in YYYY-MM-DD format",
  ),
});
