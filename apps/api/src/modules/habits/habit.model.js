import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reminder — an embedded notification schedule for a single habit.
 *
 * WHY EMBED reminders (not a separate Reminders collection)?
 * ──────────────────────────────────────────────────────────
 * Reminders are always read and written together with the habit.
 * There is no use-case for querying "all reminders across all users"
 * directly — the reminder scheduler queries Habits and fans out from there.
 * Embedding keeps the habit document self-contained and removes a join.
 *
 * Cap: MAX_REMINDERS_PER_HABIT (5) prevents unbounded array growth.
 * Above 5 reminders a user is better served by a different notification
 * strategy (e.g. OS-level habit app integration).
 */
const reminderSchema = new mongoose.Schema(
  {
    // "HH:MM" 24-hour format in the user's local timezone (stored on User.timezone)
    time: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, "Reminder time must be in HH:MM format"],
    },
    enabled: { type: Boolean, default: true },
    // Which days to fire this reminder. Empty = same as habit.targetDays.
    // Allows "remind me on Mon/Wed but track daily" patterns.
    days: { type: [Number], default: [] },
    label: { type: String, trim: true, maxlength: 50 },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Habit schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Habit — the core tracking unit per user.
 *
 * ── Denormalization strategy ─────────────────────────────────────────────────
 *
 * Three counters are stored directly on the Habit document:
 *   streakCount     — current consecutive-completion streak
 *   longestStreak   — all-time best streak
 *   totalCompletions — lifetime completion count
 *
 * These are updated synchronously whenever a HabitLog entry is created or
 * deleted (in the service layer). The write overhead is one extra
 * findOneAndUpdate per toggle, but it eliminates an aggregation pipeline from
 * every dashboard and profile read — a read-heavy workload wins this tradeoff.
 *
 * completionRate (7-day rolling, 0–1) is a heavier calculation and is
 * refreshed by a nightly cron rather than on every toggle.
 *
 * ── Completion history ───────────────────────────────────────────────────────
 *
 * Completion records live in the *HabitLog* collection (one document per
 * (habit, calendar-day)). They are NOT embedded here. See HabitLog model
 * for the detailed rationale.
 */
const habitSchema = new mongoose.Schema(
  {
    // ── Ownership ─────────────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true, // habits cannot be transferred between users
    },

    // ── Identity ──────────────────────────────────────────────────────────────
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    description: { type: String, trim: true, maxlength: 500 },
    color: {
      type: String,
      default: "#3b82f6",
      match: [/^#[0-9a-fA-F]{6}$/, "Color must be a 6-digit hex value"],
    },
    icon: { type: String, trim: true, maxlength: 50 },

    // ── Classification ────────────────────────────────────────────────────────
    category: {
      type: String,
      enum: [
        "health",
        "fitness",
        "mindfulness",
        "learning",
        "productivity",
        "social",
        "finance",
        "creativity",
        "other",
      ],
      default: "other",
      index: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard", "expert"],
      default: "medium",
    },

    // ── Schedule ──────────────────────────────────────────────────────────────
    frequency: {
      type: String,
      enum: ["daily", "weekly", "custom"],
      default: "daily",
    },
    /**
     * targetDays: day-of-week numbers (0 = Sun … 6 = Sat).
     * Rules:
     *   frequency="daily"  → targetDays is ignored (every day)
     *   frequency="weekly" → exactly one entry, e.g. [1] = every Monday
     *   frequency="custom" → any subset, e.g. [1,3,5] = Mon/Wed/Fri
     */
    targetDays: {
      type: [Number],
      default: [],
      validate: {
        validator: (days) => days.every((d) => d >= 0 && d <= 6),
        message: "Each targetDay must be 0 (Sun) through 6 (Sat)",
      },
    },
    /**
     * targetCount: how many times per period the habit should be done.
     * Default 1. A premium feature: "Run 3× per week" sets this to 3
     * with frequency="weekly".
     */
    targetCount: { type: Number, default: 1, min: 1, max: 10 },
    reminders: {
      type: [reminderSchema],
      default: [],
      validate: {
        validator: (v) => v.length <= 5,
        message: "A habit may have at most 5 reminders",
      },
    },

    // ── Gamification ─────────────────────────────────────────────────────────
    xpValue: { type: Number, default: 10, min: 1, max: 100 },

    // ── Denormalized streak counters ─────────────────────────────────────────
    /**
     * streakCount: current unbroken streak in *periods* (days for daily,
     * weeks for weekly). Reset to 0 by the streak-check cron when
     * lastCompletedAt + grace period < today.
     *
     * Updated by habit.service.js on every toggle — O(1) write instead of
     * an O(n) aggregation on every read.
     */
    streakCount: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    /**
     * lastCompletedAt: UTC timestamp of the most recent non-skipped completion.
     * Used by the streak-check cron to decide if the streak has lapsed.
     * Denormalized to avoid a MAX(completedAt) aggregation on HabitLog.
     */
    lastCompletedAt: { type: Date, default: null },

    // ── Denormalized completion stats ─────────────────────────────────────────
    /**
     * totalCompletions: lifetime count of non-skipped completions.
     * Updated on every toggle — used in badge criteria checks ("complete a
     * habit 100 times") without aggregating HabitLog.
     */
    totalCompletions: { type: Number, default: 0, min: 0 },
    /**
     * completionRate: 0–1 rolling 7-day completion rate.
     * Refreshed nightly by a cron rather than on every toggle because it
     * requires counting both expected and actual completions in the window.
     * Good enough for display ("73% this week") and not worth the write cost
     * of perfect real-time accuracy.
     */
    completionRate: { type: Number, default: 0, min: 0, max: 1 },
    completionRateUpdatedAt: { type: Date, default: null },

    // ── Streak grace (premium feature) ───────────────────────────────────────
    /**
     * gracePeriodUsedAt: the date a grace-period skip was last consumed.
     * Free: 0 grace days. Premium: 1. Enterprise: 2.
     * Stored here so the grace logic doesn't need to aggregate HabitLog.
     */
    gracePeriodUsedAt: { type: Date, default: null },

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    /**
     * order: user-defined sort position on the dashboard.
     * Stored as a float so re-ordering two items only updates one document
     * (set new order to the average of its neighbours) rather than
     * re-indexing the entire list.
     */
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes — annotated with the query each one serves
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ① PRIMARY DASHBOARD — "give me all active habits for user X, sorted by order"
 *
 * Query:  { userId: X, archived: false } sort: { order: 1 }
 * Covers: userId filter + archived filter in a single index scan.
 * The compound key order matters: userId narrows to one user's habits first,
 * then archived filters down to active ones only.
 */
habitSchema.index({ userId: 1, archived: 1, order: 1 });

/**
 * ② ANALYTICS BREAKDOWN — "category distribution for user X"
 *
 * Query:  { userId: X, archived: false } group by category
 * This index avoids a COLLSCAN when building the pie chart data.
 */
habitSchema.index({ userId: 1, category: 1, archived: 1 });

/**
 * ③ STREAK-CHECK CRON — "find habits where streak may have lapsed"
 *
 * The nightly cron runs:
 *   { userId: X, lastCompletedAt: { $lt: yesterday }, archived: false }
 * and resets streakCount to 0 for any that haven't been completed.
 * lastCompletedAt: 1 (ascending) means the oldest completions come first,
 * letting the cron page through them cheaply.
 */
habitSchema.index({ userId: 1, lastCompletedAt: 1, archived: 1 });

/**
 * ④ REMINDER SCHEDULER — "all habits with reminders, grouped by frequency"
 *
 * The push-notification job runs once per minute and needs:
 *   { frequency: "daily", archived: false, "reminders.enabled": true }
 * Indexing on frequency + archived lets it fan out to only the right habits.
 * reminders.enabled is NOT indexed because it would be a multi-key index on
 * an array — querying the top-level fields and filtering in-memory is cheaper
 * given the small reminder array size (max 5 per habit).
 */
habitSchema.index({ frequency: 1, archived: 1 });

/**
 * ⑤ STREAK LEADERBOARD — "top habits by current streak for user X"
 *
 * Query:  { userId: X, archived: false } sort: { streakCount: -1 }
 * Used on the "my streaks" screen. Compound with userId first to avoid
 * loading every active habit in the collection.
 */
habitSchema.index({ userId: 1, streakCount: -1 });

/**
 * ⑥ COMPLETION RATE REFRESH CRON — "habits whose rate is stale"
 *
 * The nightly cron finds habits not refreshed in > 23h:
 *   { completionRateUpdatedAt: { $lt: yesterday } }
 * Sparse because new habits have completionRateUpdatedAt = null and can be
 * handled by a separate first-run path.
 */
habitSchema.index(
  { completionRateUpdatedAt: 1 },
  {
    sparse: true,
    partialFilterExpression: { completionRateUpdatedAt: { $ne: null } },
  },
);

export const Habit = mongoose.model("Habit", habitSchema);
