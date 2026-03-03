/**
 * UserStats — pre-aggregated analytics snapshot per user, per period.
 *
 * ── Why a separate collection? ───────────────────────────────────────────────
 *
 * Option A — Live aggregation from HabitLog on every analytics request
 * ─────────────────────────────────────────────────────────────────────
 * PRO:  Always perfectly accurate
 * CON:  • A user with 3 years × 5 habits = 5,475 log documents.
 *         A $group + $sum across those on every chart load is expensive.
 *       • At 10k DAU, analytics queries become the dominant MongoDB load.
 *       • Aggregation pipelines require full collection scans even with indexes
 *         when grouping across many dates.
 *
 * Option B — Pre-aggregated UserStats (chosen approach)
 * ───────────────────────────────────────────────────────
 * PRO:  • Analytics reads are single-document lookups: O(1)
 *       • Charts load in < 5ms instead of 200–500ms
 *       • Historical periods are computed once and never re-computed
 * CON:  • Stats are slightly stale (up to 24h for daily cron)
 *       • Extra write complexity: cron job must run reliably
 *       • "Delete log for 3 months ago" requires re-computing that month's stats
 *
 * This is the standard solution for read-heavy analytics at scale:
 * CQRS (Command Query Responsibility Segregation) — writes go to HabitLog,
 * reads come from UserStats.
 *
 * ── Update strategy ──────────────────────────────────────────────────────────
 * • Nightly cron: upserts the current day/week/month document
 * • On habit toggle: increments today's document via $inc (avoids full recompute)
 *   This gives real-time accuracy for "today" while historical is batch-updated.
 */
import mongoose from "mongoose";

/**
 * DailyCategoryBreakdown — embedded stats per category for one day.
 * Stored as a flat object rather than an array for O(1) key access.
 */
const categoryStatsSchema = new mongoose.Schema(
  {
    completions: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
    streakProgress: { type: Number, default: 0 }, // % of habits with active streak
  },
  { _id: false },
);

const userStatsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /**
     * period: granularity of this stats document.
     *   "day"   → covers a single YYYY-MM-DD
     *   "week"  → covers Mon–Sun of a given ISO week
     *   "month" → covers a full calendar month
     *
     * WHY NOT one giant document per user?
     * ──────────────────────────────────────
     * Embedding all history in one document brings back the array-bloat
     * problem we avoided in HabitLog. Separate documents per period means:
     *   • Each document stays small (~1 KB)
     *   • Historical periods can be archived to cold storage
     *   • Queries like "give me all weekly stats for 2024" are index range scans
     */
    period: {
      type: String,
      enum: ["day", "week", "month"],
      required: true,
    },
    /**
     * periodKey: ISO string identifier for the period.
     *   day   → "2025-03-10"
     *   week  → "2025-W10"  (ISO week)
     *   month → "2025-03"
     *
     * String format chosen (same rationale as HabitLog.dateKey) — lexicographic
     * sort = chronological sort, range queries work naturally.
     */
    periodKey: { type: String, required: true },

    // ── Completion stats ────────────────────────────────────────────────────
    totalCompletions: { type: Number, default: 0 },
    totalSkips: { type: Number, default: 0 },
    /**
     * expectedCompletions: how many completions SHOULD have happened in this
     * period (based on each habit's frequency × targetCount).
     * Used to compute completionRate = totalCompletions / expectedCompletions.
     */
    expectedCompletions: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0, min: 0, max: 1 },

    // ── XP & gamification ───────────────────────────────────────────────────
    xpEarned: { type: Number, default: 0 },
    xpFromBadges: { type: Number, default: 0 },
    badgesEarned: { type: Number, default: 0 },

    // ── Streaks ─────────────────────────────────────────────────────────────
    /**
     * bestStreak: the longest streak any single habit held during this period.
     * Different from User.currentStreakDays (which is cross-habit).
     */
    bestStreak: { type: Number, default: 0 },
    habitsWithActiveStreak: { type: Number, default: 0 },
    habitsStreakBroken: { type: Number, default: 0 },

    // ── Time analytics ───────────────────────────────────────────────────────
    totalDurationMinutes: { type: Number, default: 0 },
    avgMood: { type: Number, default: null, min: 1, max: 5 },

    // ── Category breakdown ───────────────────────────────────────────────────
    /**
     * byCategory: { "health": { completions: 5, xpEarned: 50 }, ... }
     *
     * WHY AN OBJECT MAP instead of an array?
     * ─────────────────────────────────────────
     * An object map allows $inc updates by key:
     *   { $inc: { "byCategory.health.completions": 1 } }
     * An array would require $elemMatch + $set with a positional operator —
     * much more complex and not atomic without transactions.
     */
    byCategory: {
      type: Map,
      of: categoryStatsSchema,
      default: {},
    },

    // ── Most active habit ────────────────────────────────────────────────────
    topHabitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Habit",
      default: null,
    },
    topHabitCompletions: { type: Number, default: 0 },

    // ── Metadata ─────────────────────────────────────────────────────────────
    /** computedAt: when this document was last refreshed by the cron. */
    computedAt: { type: Date, required: true, default: Date.now },
    /** isPartial: true for the current period (not yet fully elapsed). */
    isPartial: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ① PRIMARY LOOKUP — unique identity for each stats document
 *
 * Query:  { userId: X, period: "day", periodKey: "2025-03-10" }
 * Used by: the cron upsert, the dashboard analytics API.
 *
 * Unique ensures the cron can safely use upsert: true without creating
 * duplicate documents on concurrent runs.
 */
userStatsSchema.index(
  { userId: 1, period: 1, periodKey: 1 },
  { unique: true },
);

/**
 * ② RANGE ANALYTICS — "all monthly stats for user X in 2024"
 *
 * Query:  { userId: X, period: "month", periodKey: { $gte: "2024-01", $lte: "2024-12" } }
 * The string periodKey sorts lexicographically = chronologically for ISO dates.
 */
userStatsSchema.index({ userId: 1, period: 1, periodKey: -1 });

/**
 * ③ STALE-CRON DETECTION — "find partial stats documents not refreshed in 23h"
 *
 * The cron skips fully-elapsed historical periods and only re-computes
 * documents where isPartial = true and computedAt is old.
 */
userStatsSchema.index(
  { computedAt: 1, isPartial: 1 },
  { partialFilterExpression: { isPartial: true } },
);

export const UserStats = mongoose.model("UserStats", userStatsSchema);
