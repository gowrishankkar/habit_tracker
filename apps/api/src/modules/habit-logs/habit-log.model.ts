/**
 * HabitLog — one document per (habit, calendar-day) pair.
 *
 * Why a separate collection instead of embedding into Habit?
 * ─────────────────────────────────────────────────────────
 * A daily habit tracked for 3 years generates ~1 095 completion entries.
 * Embedding that array into the Habit document would:
 *   • Bloat every habit read with history the UI rarely needs.
 *   • Risk approaching MongoDB's 16 MB document cap for power users.
 *   • Make date-range aggregations (analytics, heatmaps) require loading
 *     the whole document instead of a targeted index scan.
 *
 * The tradeoff is that fetching "today's habits + today's completions"
 * requires two queries (or a $lookup). That's an acceptable cost because:
 *   • Both queries are fully covered by their respective indexes.
 *   • The dashboard payload is small (< 50 habits per user in practice).
 */
import mongoose, { type Document } from "mongoose";

export interface IHabitLog extends Document {
  habitId: mongoose.Types.ObjectId;
  // userId is denormalized here so analytics aggregations can run on this
  // collection alone without joining back to habits.
  userId: mongoose.Types.ObjectId;
  completedAt: Date;   // exact UTC timestamp — for ordering & time-of-day analytics
  // Calendar date string "YYYY-MM-DD" in the *user's local timezone*.
  // Stored as a string so date equality checks are O(1) string compares
  // rather than range queries, and the unique index below prevents
  // two completions on the same calendar day regardless of DST shifts.
  dateKey: string;
  note?: string;
  xpEarned: number;
  // skipped = true means the user explicitly marked this day as skipped.
  // Distinguishes "didn't do it" (gap in logs) from "chose to skip" for
  // streak-grace logic on premium plans.
  skipped: boolean;
}

const habitLogSchema = new mongoose.Schema<IHabitLog>(
  {
    habitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Habit",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    completedAt: { type: Date, required: true, default: Date.now },
    dateKey: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    note: { type: String, trim: true, maxlength: 500 },
    xpEarned: { type: Number, default: 0, min: 0 },
    skipped: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    // Disable the default _id index on the sub-document level if you ever
    // embed this schema — not relevant here but good practice to note.
  },
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// ① Idempotency guard: exactly one log per (habit, calendar-day).
//   Also the primary read path for "did I complete this habit today?"
//   and for rendering a habit's full history in chronological order.
habitLogSchema.index({ habitId: 1, dateKey: 1 }, { unique: true });

// ② Dashboard query: "which of my habits did I complete today?"
//   userId + dateKey covers the two filters used on every page load.
habitLogSchema.index({ userId: 1, dateKey: 1 });

// ③ Activity feed: recent completions across all habits for a user.
//   The -1 on completedAt lets MongoDB serve the most-recent-first sort
//   without a blocking sort stage.
habitLogSchema.index({ userId: 1, completedAt: -1 });

// ④ Habit-specific history & streak calculation: walking backwards through
//   a single habit's completions in reverse chronological order.
habitLogSchema.index({ habitId: 1, completedAt: -1 });

// ⑤ XP analytics (partial index): aggregate earned XP per user in a period.
//   The partial filter skips skipped/zero-xp documents, shrinking the index.
habitLogSchema.index(
  { userId: 1, completedAt: 1, xpEarned: 1 },
  { partialFilterExpression: { xpEarned: { $gt: 0 }, skipped: false } },
);

export const HabitLog = mongoose.model<IHabitLog>("HabitLog", habitLogSchema);
