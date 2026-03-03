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
};

/** Returns the total XP required to reach `level` (quadratic curve). */
export const xpForLevel = (level) => level * level * 100;

export const STREAK_GRACE_DAYS = {
  free: 0,
  premium: 1,
  enterprise: 2,
};

// ── Habit ─────────────────────────────────────────────────────────────────────
export const HABIT_COLORS = Object.freeze([
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
]);

export const HABIT_CATEGORIES = Object.freeze([
  "health",
  "fitness",
  "mindfulness",
  "learning",
  "productivity",
  "social",
  "finance",
  "creativity",
  "other",
]);

export const MAX_REMINDERS_PER_HABIT = 5;

// ── Pagination ────────────────────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
