// ─────────────────────────────────────────────────────────────────────────────
// Domain types shared across the auth system
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  xp: number;
  level: number;
  subscriptionTier: "free" | "premium";
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Habit domain types
// ─────────────────────────────────────────────────────────────────────────────

export type HabitFrequency = "daily" | "weekly" | "custom";
export type HabitDifficulty = "easy" | "medium" | "hard" | "expert";
export type HabitCategory =
  | "health"
  | "fitness"
  | "mindfulness"
  | "learning"
  | "productivity"
  | "social"
  | "finance"
  | "creativity"
  | "other";

export interface Habit {
  _id: string;
  title: string;
  description?: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  targetDays: number[]; // 0=Sun…6=Sat
  targetCount: number; // completions required per period
  streakCount: number;
  longestStreak: number;
  totalCompletions: number;
  completionRate: number; // 0-100
  difficulty: HabitDifficulty;
  xpValue: number;
  archived: boolean;
  /** ISO string of the last completed log entry; null when never completed */
  lastCompletedAt: string | null;
  color: string;
  order: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHabitDto {
  title: string;
  description?: string;
  category?: HabitCategory;
  frequency?: HabitFrequency;
  targetDays?: number[];
  targetCount?: number;
  difficulty?: HabitDifficulty;
  color?: string;
}

export interface UpdateHabitDto extends Partial<CreateHabitDto> {}

// ─────────────────────────────────────────────────────────────────────────────
// Gamification types
// ─────────────────────────────────────────────────────────────────────────────

export interface BadgeEarned {
  _id: string;
  name: string;
  description: string;
  unlockMessage?: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  xpReward: number;
}

export interface GamificationResult {
  /** XP gained (positive) or refunded (negative) from this toggle */
  xpGained: number;
  /** User's total XP after this toggle (includes badge XP if any) */
  newXp: number;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  /** Badges newly awarded by this toggle */
  newBadges: BadgeEarned[];
  /** Crossed milestone codes e.g. ["streak_7", "first_completion"] */
  milestones: string[];
}

/** Decorated gamification event used for the in-app notification queue */
export interface GamificationEvent extends GamificationResult {
  /** Client-generated UUID for stable keys + dismissal */
  id: string;
  habitTitle: string;
}

/** Toggle response shape returned by POST /habits/:id/toggle */
export interface ToggleCompletionResult {
  habit: Habit;
  gamification: GamificationResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics types
// ─────────────────────────────────────────────────────────────────────────────

export interface WeeklyDataPoint {
  dateKey: string;
  label: string; // "Mon", "Tue"…
  count: number;
  xpEarned: number;
}

export interface MonthlyDataPoint {
  week: string; // "2025-W12"
  count: number;
  xpEarned: number;
  avgPerDay: number;
}

export interface HeatmapDay {
  dateKey: string; // "YYYY-MM-DD"
  count: number;
}

export interface StreakEntry {
  _id: string;
  title: string;
  streakCount: number;
  longestStreak: number;
  category: string;
  color: string;
}

export interface CategorySlice {
  category: string;
  habitCount: number;
  totalCompletions: number;
  avgStreak: number;
  avgCompletionRate: number;
}

export interface AnalyticsSummary {
  totalHabits: number;
  totalCompletions: number;
  longestStreak: number;
  avgCompletionRate: number;
  totalXp: number;
}


export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─────────────────────────────────────────────────────────────────────────────
// Auth API payloads
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

