// ── Primitives ────────────────────────────────────────────────────────────────

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

export type SubscriptionTier = "free" | "premium" | "enterprise";

export type BadgeTier = "bronze" | "silver" | "gold" | "platinum";

export type BadgeCriteriaType =
  | "streak"
  | "total_completions"
  | "level"
  | "category_master";

// ── Habit ─────────────────────────────────────────────────────────────────────

export interface Habit {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  /** Day-of-week numbers (0 = Sun … 6 = Sat). Empty = every day. */
  targetDays: number[];
  reminders: Reminder[];
  streakCount: number;
  longestStreak: number;
  lastCompletedAt?: string;
  difficulty: HabitDifficulty;
  xpValue: number;
  color: string;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  time: string;     // "HH:MM"
  enabled: boolean;
}

export interface CreateHabitDto {
  title: string;
  description?: string;
  category?: HabitCategory;
  frequency?: HabitFrequency;
  targetDays?: number[];
  reminders?: Reminder[];
  difficulty?: HabitDifficulty;
  xpValue?: number;
  color?: string;
}

export interface UpdateHabitDto {
  title?: string;
  description?: string;
  category?: HabitCategory;
  frequency?: HabitFrequency;
  targetDays?: number[];
  reminders?: Reminder[];
  difficulty?: HabitDifficulty;
  xpValue?: number;
  color?: string;
  archived?: boolean;
}

// ── HabitLog ──────────────────────────────────────────────────────────────────

export interface HabitLog {
  _id: string;
  habitId: string;
  userId: string;
  completedAt: string;  // ISO timestamp
  dateKey: string;      // "YYYY-MM-DD"
  note?: string;
  xpEarned: number;
  skipped: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHabitLogDto {
  habitId: string;
  dateKey: string;
  note?: string;
  skipped?: boolean;
}

// ── Badge ─────────────────────────────────────────────────────────────────────

export interface BadgeCriteria {
  type: BadgeCriteriaType;
  threshold: number;
  category?: HabitCategory;
}

export interface Badge {
  _id: string;
  name: string;
  description: string;
  icon: string;
  criteria: BadgeCriteria;
  xpReward: number;
  tier: BadgeTier;
}

export interface UserBadge {
  badgeId: string;
  earnedAt: string;
}

// ── User ──────────────────────────────────────────────────────────────────────

export interface UserPublic {
  _id: string;
  name: string;
  email: string;
  xp: number;
  level: number;
  badges: UserBadge[];
  subscriptionTier: SubscriptionTier;
  timezone: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  timezone?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: UserPublic;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}
