/**
 * HabitLog — one document per (habit, calendar-day) pair.
 *
 * ── Why a separate collection? ───────────────────────────────────────────────
 *
 * Option A — Embed completions array inside Habit document
 * ────────────────────────────────────────────────────────
 * PRO:  Single document read for "habit + all its history"
 * CON:  • A daily habit tracked 3 years = 1,095 entries → document bloat
 *       • MongoDB hard cap: 16 MB per document. A habit with notes and
 *         metadata per completion hits this in ~4-5 years
 *       • Every dashboard read fetches years of history the UI never shows
 *       • Date-range aggregations (heatmaps, monthly reports) require loading
 *         the entire document before filtering in memory
 *       • Updates (push/pull from array) hold a write lock on the whole document
 *
 * Option B — Separate HabitLog collection (chosen approach)
 * ──────────────────────────────────────────────────────────
 * PRO:  • Unbounded growth without document cap risk
 *       • Date-range queries hit only the relevant index range — O(log n)
 *         even for multi-year datasets
 *       • Dashboard reads two small queries, both index-covered
 *       • Analytics aggregations ($group, $sum) run on this lean collection
 *       • Each document is an independent write — no array lock contention
 * CON:  • "Did I complete this habit today?" needs two queries (or $lookup)
 *       • Slightly more complex service layer
 *
 * The CON is mitigated by: (a) compound indexes that make both queries
 * sub-millisecond, and (b) batching: the dashboard fetches today's logs
 * for ALL habits in a single query, not one per habit.
 */
import mongoose from "mongoose";

const habitLogSchema = new mongoose.Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    habitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Habit",
      required: true,
    },
    /**
     * userId is denormalized (also on the Habit document) so that analytics
     * aggregations can run on this collection alone, without a $lookup back to
     * habits. The extra 12 bytes per document is worth it — $lookup is expensive
     * at scale.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── Temporal data ─────────────────────────────────────────────────────────
    /**
     * completedAt: exact UTC timestamp.
     * Used for: activity feed ordering, time-of-day analytics
     * ("users complete fitness habits most at 7am"), streak walking.
     */
    completedAt: { type: Date, required: true, default: Date.now },

    /**
     * dateKey: "YYYY-MM-DD" in the USER'S local timezone (not UTC).
     *
     * WHY A STRING instead of a Date field?
     * ──────────────────────────────────────
     * Consider a user in UTC-5 who completes a habit at 23:30 on Monday.
     * In UTC that's 04:30 Tuesday. If we store the UTC Date and compare
     * with `$gte: startOfDayUTC`, we get the wrong calendar day for this user.
     *
     * Storing "2025-03-10" as a string computed in the user's timezone means:
     *   • Equality checks ("did I complete this today?") are O(1) string compares
     *   • The unique index {habitId, dateKey} correctly enforces one-per-day
     *     regardless of DST or timezone changes
     *   • No timezone math needed at query time — just compare the string
     *
     * The client sends the dateKey; the server validates the format but trusts
     * the client's local date (users know what day it is for them).
     */
    dateKey: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "dateKey must be YYYY-MM-DD"],
    },

    // ── Rich completion data ───────────────────────────────────────────────────
    note: { type: String, trim: true, maxlength: 500 },
    xpEarned: { type: Number, default: 0, min: 0 },

    /**
     * durationMinutes: how long the user spent on the habit (optional).
     * Enables time-tracking analytics: "You spent 47 hours running this month."
     * Max 1440 (= 24 hours) to catch data-entry errors.
     */
    durationMinutes: { type: Number, min: 0, max: 1440, default: null },

    /**
     * mood: 1–5 subjective rating after completing the habit.
     * Powers a "how do you feel after this habit?" correlation chart.
     * null = user didn't rate (most common case).
     */
    mood: { type: Number, min: 1, max: 5, default: null },

    /**
     * skipped: user explicitly marked this period as intentionally skipped.
     *
     * WHY TRACK SKIPS?
     * ─────────────────
     * A gap in HabitLog could mean:
     *   (a) The user forgot / failed — streak should break
     *   (b) The user was on vacation and deliberately skipped — streak-grace
     *
     * Storing skipped=true distinguishes (b) from (a).
     * Premium users get N grace days (from User.subscriptionTier) where a
     * skipped log prevents the streak from resetting.
     */
    skipped: { type: Boolean, default: false },

    /**
     * gracePeriod: true = this log consumed a streak grace slot.
     * Lets the service check "has this user already used their grace
     * allowance this week?" without scanning all logs.
     */
    gracePeriod: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes — each annotated with the query it serves and the tradeoff
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ① IDEMPOTENCY GUARD + HABIT HISTORY
 *
 * Unique compound index: exactly one log per (habit, calendar-day).
 * On duplicate toggle: { habitId, dateKey } collision → 11000 error caught
 * by the service layer (delete instead of insert = toggle-off).
 *
 * Also serves:
 *   • "Did I complete habit X on date Y?" — point lookup
 *   • "Full history of habit X in chronological order" — range scan on dateKey
 *
 * Tradeoff: unique indexes are slightly slower on inserts because MongoDB must
 * check for conflicts. Acceptable here — toggle rate is low (≤ once/day/habit).
 */
habitLogSchema.index({ habitId: 1, dateKey: 1 }, { unique: true });

/**
 * ② DASHBOARD — "which of my habits did I complete today?"
 *
 * Query:  { userId: X, dateKey: "2025-03-10" }
 * Called on every page load. The most frequent read in the entire system.
 *
 * Returns: array of { habitId } documents — joined in application layer to
 * the Habits query. Avoids $lookup which would be O(habits × logs).
 *
 * Tradeoff: userId is denormalized (also accessible via Habit.userId) but
 * it saves the $lookup cost on what is the hottest query path.
 */
habitLogSchema.index({ userId: 1, dateKey: 1 });

/**
 * ③ ACTIVITY FEED — "recent completions across all habits, newest first"
 *
 * Query:  { userId: X } sort: { completedAt: -1 } limit: 20
 * The -1 direction means MongoDB walks the index in descending order,
 * serving the most-recent results without a blocking sort stage.
 */
habitLogSchema.index({ userId: 1, completedAt: -1 });

/**
 * ④ HABIT HISTORY & STREAK WALK — "all logs for habit X, newest first"
 *
 * Query:  { habitId: X } sort: { completedAt: -1 }
 * Used by:
 *   • The habit history screen (paginated)
 *   • The streak recalculation after a retroactive log deletion
 *   • Heatmap data for a specific habit
 */
habitLogSchema.index({ habitId: 1, completedAt: -1 });

/**
 * ⑤ DATE-RANGE ANALYTICS — "completions in a date window for user X"
 *
 * Query:  { userId: X, dateKey: { $gte: "2025-01-01", $lte: "2025-01-31" } }
 * Used by: monthly report, streak history chart, heatmap calendar.
 *
 * dateKey as a string sorts lexicographically, which happens to be
 * chronological for ISO 8601 format (YYYY-MM-DD) — so range queries work
 * exactly like Date range queries without timezone math.
 */
habitLogSchema.index({ userId: 1, dateKey: 1, habitId: 1 });

/**
 * ⑥ XP ANALYTICS — "total XP earned by user X in a time window"
 *
 * Query:  { userId: X, completedAt: { $gte, $lte }, xpEarned: { $gt: 0 } }
 * Used by: weekly XP summary, level-up check.
 *
 * PARTIAL INDEX: skips documents where xpEarned = 0 or skipped = true.
 * This shrinks the index by ~30% (skipped logs earn 0 XP) and speeds up
 * XP aggregation scans because the irrelevant documents aren't indexed.
 *
 * Tradeoff: partial indexes can only be used when the query includes the
 * partial filter expression. Always include { xpEarned: { $gt: 0 }, skipped: false }
 * in XP queries or MongoDB falls back to a COLLSCAN.
 */
habitLogSchema.index(
  { userId: 1, completedAt: 1, xpEarned: 1 },
  {
    name: "xp_analytics",
    partialFilterExpression: { xpEarned: { $gt: 0 }, skipped: false },
  },
);

/**
 * ⑦ MOOD ANALYTICS — "average mood per habit over time" (premium)
 *
 * Query:  { habitId: X, mood: { $ne: null } } sort: { completedAt: -1 }
 * Partial index skips the ~80% of logs where mood = null (users rarely rate).
 * Without this, a mood chart aggregation would scan the entire HabitLog
 * collection for a user's habit history.
 */
habitLogSchema.index(
  { habitId: 1, mood: 1, completedAt: -1 },
  {
    name: "mood_analytics",
    partialFilterExpression: { mood: { $ne: null } },
  },
);

export const HabitLog = mongoose.model("HabitLog", habitLogSchema);
