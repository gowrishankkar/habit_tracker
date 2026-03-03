/**
 * Badge — static reference collection seeded once, read heavily.
 *
 * ── Why NOT embed badges in User? ────────────────────────────────────────────
 *
 * Option A — Embed full badge definition in User.badges[]
 * ────────────────────────────────────────────────────────
 * PRO:  Single document read for user profile + badges
 * CON:  • Badge content changes (new icon, re-worded description, XP reward
 *         update) require a fan-out write to every User who earned it.
 *         At 100k users × 10 avg badges = 1M document updates per badge edit.
 *       • No source of truth for available badges separate from earned badges
 *       • Can't paginate / filter the badge catalog without scanning all Users
 *
 * Option B — Reference (chosen): store only { badgeId, earnedAt } on User
 * ──────────────────────────────────────────────────────────────────────────
 * PRO:  • Badge metadata updates are a single-document write
 *       • Badge catalog is independently queryable (admin panel, achievement list)
 *       • User.badges stays small (≤ 50 entries) — safe to embed the references
 * CON:  • Profile page needs a $lookup or a second read to hydrate badge details
 *       • Mitigated by: badge catalog is tiny (~100 docs), fits in app memory cache
 */
import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BadgeCriteria — the conditions that must be met for the badge to be awarded.
 *
 * WHY EMBED criteria instead of a separate BadgeCriteria collection?
 * ──────────────────────────────────────────────────────────────────
 * Criteria are always read with the badge. The number of criteria per badge
 * is bounded (1–3). Embedding is the natural fit — no join needed, and there
 * is no use case for querying criteria independent of their badge.
 */
const badgeCriteriaSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "streak",            // current streak >= threshold
        "total_completions", // lifetime completions >= threshold
        "level",             // user level >= threshold
        "category_master",   // completions in one category >= threshold
        "xp_milestone",      // total XP earned >= threshold
        "consistency",       // 7-day completion rate >= threshold (0–1 float)
      ],
      required: true,
    },
    threshold: { type: Number, required: true, min: 0 },
    // Only set when type === "category_master"
    category: { type: String },
    /**
     * For "consistency" type, threshold is a float (0.8 = 80% completion rate).
     * For all other types, threshold is an integer.
     */
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Badge schema
// ─────────────────────────────────────────────────────────────────────────────

const badgeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true, trim: true },
    /**
     * unlockMessage: shown to the user in the badge-earned notification.
     * Different from description ("You've earned X") vs catalog copy ("Earn X by...").
     */
    unlockMessage: { type: String, trim: true, maxlength: 200 },
    icon: { type: String, required: true, trim: true },

    /**
     * criteria: array of ALL conditions that must be satisfied simultaneously.
     * Single criterion is most common. Multi-criterion enables complex badges:
     * "Reach level 10 AND complete 500 habits" (two criteria, both required).
     *
     * WHY AN ARRAY instead of a single embedded object?
     * ────────────────────────────────────────────────────
     * Future-proofing: OR logic ("streak >= 30 OR total >= 200") could be added
     * by introducing an `operator` field. Starting with an array costs nothing
     * today and avoids a schema migration later.
     */
    criteria: {
      type: [badgeCriteriaSchema],
      required: true,
      validate: {
        validator: (v) => v.length >= 1 && v.length <= 3,
        message: "A badge must have 1–3 criteria",
      },
    },

    xpReward: { type: Number, required: true, min: 0 },
    tier: {
      type: String,
      enum: ["bronze", "silver", "gold", "platinum"],
      required: true,
    },

    /**
     * rarity: percentage of users who have earned this badge (0–1).
     * Updated nightly by an analytics job. Displayed as "Rare · 2.3%" in the UI.
     * Stored here so we don't need to aggregate User.badges at display time.
     */
    rarity: { type: Number, min: 0, max: 1, default: null },

    /**
     * order: display order within a tier on the achievements page.
     * Float for cheap re-ordering (same trick as Habit.order).
     */
    order: { type: Number, default: 0 },

    /** active: false hides a badge from the catalog without deleting it. */
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ① AWARD-CHECK — "find badges whose criteria a user just satisfied"
 *
 * After each habit completion, the service runs:
 *   { "criteria.type": "streak", "criteria.threshold": { $lte: newStreak } }
 * This index makes that lookup O(log n) over the badge catalog.
 *
 * The multi-key index on criteria[] is handled automatically by MongoDB
 * when the field is an array. Each criteria element is individually indexed.
 *
 * Tradeoff: multi-key indexes cannot be covered (MongoDB can't return array
 * element fields from the index alone). The full badge document is still
 * fetched — acceptable because the badge catalog is tiny (~100 docs).
 */
badgeSchema.index({ "criteria.type": 1, "criteria.threshold": 1 });

/**
 * ② CATALOG PAGE — "all active badges sorted by tier then order"
 *
 * Query:  { active: true } sort: { tier: 1, order: 1 }
 * Used by the achievement screen and the admin badge editor.
 * Partial index skips inactive badges.
 */
badgeSchema.index(
  { tier: 1, order: 1 },
  { partialFilterExpression: { active: true } },
);

export const Badge = mongoose.model("Badge", badgeSchema);
