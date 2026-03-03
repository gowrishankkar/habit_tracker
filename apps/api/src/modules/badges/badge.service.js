/**
 * Badge Service
 * ─────────────
 * Handles badge eligibility checks and atomic awarding.
 *
 * Design constraints:
 *   • Idempotent: badges already earned by the user are never re-awarded.
 *     The check happens in-application (not DB-level) but is safe for our
 *     single-request-per-user concurrency model.
 *   • Efficient: only badges whose criteria *type* matches what changed in
 *     this toggle are evaluated. A streak badge is never evaluated when
 *     only xp changed.
 *   • Atomic award: XP reward for badges is bundled into the same User
 *     update that pushes the badge reference, preventing partial state.
 *
 * Badge criteria types and how they're evaluated:
 *
 *   streak            → context.habitStreakCount >= threshold
 *   total_completions → context.habitTotalCompletions >= threshold
 *   level             → context.userLevel >= threshold
 *   xp_milestone      → context.userXp >= threshold
 *   category_master   → context.categoryCompletions[cat] >= threshold
 *   consistency       → context.habitCompletionRate >= threshold (0–1)
 */

import mongoose from "mongoose";
import { Badge } from "./badge.model.js";
import { User } from "../users/user.model.js";
import { Habit } from "../habits/habit.model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Criteria evaluator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate a single BadgeCriteria document against the current context.
 *
 * @param {{ type: string, threshold: number, category?: string }} criteria
 * @param {BadgeContext} ctx
 * @returns {boolean}
 */
function evaluateCriterion(criteria, ctx) {
  switch (criteria.type) {
    case "streak":
      return ctx.habitStreakCount >= criteria.threshold;
    case "total_completions":
      return ctx.habitTotalCompletions >= criteria.threshold;
    case "level":
      return ctx.userLevel >= criteria.threshold;
    case "xp_milestone":
      return ctx.userXp >= criteria.threshold;
    case "category_master": {
      const count = ctx.categoryCompletions?.[criteria.category] ?? 0;
      return count >= criteria.threshold;
    }
    case "consistency":
      return ctx.habitCompletionRate >= criteria.threshold;
    default:
      return false;
  }
}

/**
 * Determine whether ALL criteria for a badge are met.
 *
 * @param {object[]} criteria   — badge.criteria array
 * @param {BadgeContext} ctx
 * @returns {boolean}
 */
function badgeIsEligible(criteria, ctx) {
  return criteria.every((c) => evaluateCriterion(c, ctx));
}

// ─────────────────────────────────────────────────────────────────────────────
// Category completion aggregation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate total completions per category for this user.
 * Only called when at least one unearned badge has category_master criteria.
 *
 * Uses Habit.totalCompletions (denormalized) so this is a simple group-by
 * on the Habit collection — no join to HabitLog needed.
 *
 * @param {string} userId
 * @returns {Promise<Record<string, number>>}  { health: 42, fitness: 17, ... }
 */
async function getCategoryCompletions(userId) {
  const rows = await Habit.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), archived: false } },
    {
      $group: {
        _id: "$category",
        total: { $sum: "$totalCompletions" },
      },
    },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.total]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} BadgeContext
 * @property {number} habitStreakCount
 * @property {number} habitTotalCompletions
 * @property {number} habitCompletionRate   — 0–1
 * @property {string} habitCategory
 * @property {number} userLevel
 * @property {number} userXp                — AFTER this completion's XP was applied
 * @property {string[]} alreadyEarnedIds    — string IDs of badges already in user.badges
 */

/**
 * Check all active badges the user hasn't earned yet and award any that are
 * now eligible.  Returns the list of newly awarded Badge documents (with
 * xpReward populated) so the caller can include them in the response payload.
 *
 * Idempotency: `alreadyEarnedIds` is checked before any DB write.
 * Badge XP rewards are included in the atomic User update below, so the
 * user can never gain badge XP without the badge reference being stored.
 *
 * @param {string}      userId
 * @param {BadgeContext} ctx
 * @returns {Promise<object[]>}  — newly awarded badge documents
 */
export async function checkAndAwardBadges(userId, ctx) {
  // 1. Load all active badges not yet earned by this user
  const unearnedBadges = await Badge.find({
    active: true,
    _id: { $nin: ctx.alreadyEarnedIds.map((id) => new mongoose.Types.ObjectId(id)) },
  }).lean();

  if (unearnedBadges.length === 0) return [];

  // 2. Lazily fetch category completions only if needed
  const needsCategoryCheck = unearnedBadges.some((b) =>
    b.criteria.some((c) => c.type === "category_master"),
  );
  if (needsCategoryCheck) {
    ctx.categoryCompletions = await getCategoryCompletions(userId);
  }

  // 3. Find newly eligible badges
  const toAward = unearnedBadges.filter((b) => badgeIsEligible(b.criteria, ctx));

  if (toAward.length === 0) return [];

  // 4. Award atomically: push badge references + accumulate badge XP in one update
  const totalBadgeXp = toAward.reduce((sum, b) => sum + (b.xpReward ?? 0), 0);

  const badgeEntries = toAward.map((b) => ({
    badgeId: b._id,
    earnedAt: new Date(),
    xpSnapshot: b.xpReward ?? 0,
  }));

  await User.findByIdAndUpdate(userId, {
    $push: { badges: { $each: badgeEntries } },
    // Badge XP is additive; the caller already applied completion XP separately
    $inc: { xp: totalBadgeXp },
  });

  return toAward;
}
