// ── Validation ────────────────────────────────────────────────────────────────
export const PASSWORD_MIN_LENGTH = 8;
export const HABIT_TITLE_MAX_LENGTH = 100;
export const HABIT_DESCRIPTION_MAX_LENGTH = 500;
export const HABIT_LOG_NOTE_MAX_LENGTH = 500;

// ── Gamification ──────────────────────────────────────────────────────────────
export const XP_PER_DIFFICULTY = {
  easy: 5,
  medium: 10,
  hard: 20,
  expert: 40,
} as const;

// Level thresholds: level N requires XP_LEVEL_THRESHOLDS[N-1] total XP.
// Formula: level^2 * 100  (simple quadratic curve)
export const xpForLevel = (level: number): number => level * level * 100;

export const STREAK_GRACE_DAYS: Record<"free" | "premium" | "enterprise", number> = {
  free: 0,
  premium: 1,
  enterprise: 2,
} as const;

// ── Habit ─────────────────────────────────────────────────────────────────────
export const HABIT_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
] as const;

export const HABIT_CATEGORIES = [
  "health",
  "fitness",
  "mindfulness",
  "learning",
  "productivity",
  "social",
  "finance",
  "creativity",
  "other",
] as const;

export const MAX_REMINDERS_PER_HABIT = 5;

// ── Pagination ────────────────────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
