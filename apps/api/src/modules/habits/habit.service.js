import { habitRepository } from "./habit.repository.js";
import { HabitLog } from "../habit-logs/habit-log.model.js";
import { User } from "../users/user.model.js";
import { userRepository } from "../users/user.repository.js";
import {
  computeStreakAfterAdd,
  computeStreakAfterRemove,
} from "../../utils/streakEngine.js";
import {
  calculateXp,
  detectMilestones,
} from "../../utils/gamification.js";
import { checkAndAwardBadges } from "../badges/badge.service.js";

/**
 * Habit service — owns all habit business logic.
 *
 * The toggle implementation uses the HabitLog collection as the source of
 * truth for completions rather than embedding an array in the Habit document.
 * Streak counters are denormalized onto the Habit and updated here to avoid
 * expensive aggregations on every dashboard read.
 *
 * Gamification flow (on complete):
 *   1. Create HabitLog with XP = calculateXp(habit.xpValue, newStreakCount)
 *   2. Persist streak changes on Habit
 *   3. Apply XP delta to User, recalculate level
 *   4. Check badge eligibility; award any newly earned badges
 *   5. Detect milestone codes (crossed thresholds)
 *   6. Return { habit, gamification } so the controller can pass it to the client
 *
 * Idempotency guarantees:
 *   • HabitLog has a unique index on { habitId, dateKey } — double-toggle
 *     in the same second hits a duplicate-key error caught by the existing
 *     logic (existing truthy → uncomplete path).
 *   • XP stored on HabitLog.xpEarned is the source of truth for refunds.
 *     Uncomplete reads exactly what was given and subtracts it — never a
 *     re-calculation that could differ if multipliers changed.
 *   • Badge award check uses alreadyEarnedIds to skip already-earned badges.
 */

export async function list(userId) {
  return habitRepository.findByUser(userId);
}

export async function create(userId, dto) {
  return habitRepository.create(userId, dto);
}

export async function update(habitId, userId, dto) {
  return habitRepository.update(habitId, userId, dto);
}

export async function remove(habitId, userId) {
  return habitRepository.delete(habitId, userId);
}

/**
 * Build the HabitConfig object expected by the streak engine from a Habit doc.
 */
function habitConfig(habit) {
  return {
    frequency: habit.frequency ?? "daily",
    targetDays: habit.targetDays ?? [],
    targetCount: habit.targetCount ?? 1,
  };
}

/**
 * Toggle completion for a habit on a given calendar date (YYYY-MM-DD).
 *
 * Returns:
 *   {
 *     habit: <updated Habit plain object>,
 *     gamification: {
 *       xpGained: number,        — positive on complete, negative on uncomplete
 *       newXp: number,           — user's total XP after this toggle
 *       previousLevel: number,
 *       newLevel: number,
 *       leveledUp: boolean,
 *       newBadges: BadgeDoc[],   — newly awarded badge documents
 *       milestones: string[],    — milestone code strings
 *     }
 *   }
 *
 * @param {string} habitId
 * @param {string} userId
 * @param {string} dateKey    "YYYY-MM-DD" in the user's local timezone
 * @param {string} todayKey   "YYYY-MM-DD" — the user's current local date
 * @param {number} [gracePeriods=0]
 * @returns {Promise<{ habit: object, gamification: object } | null>}
 */
export async function toggleCompletion(
  habitId,
  userId,
  dateKey,
  todayKey,
  gracePeriods = 0,
) {
  const habit = await habitRepository.findOne(habitId, userId);
  if (!habit) return null;

  const existing = await HabitLog.findOne({ habitId, dateKey });
  const config = habitConfig(habit);

  // Snapshot state BEFORE this toggle for milestone comparison
  const prevCompletions = habit.totalCompletions ?? 0;
  const prevStreak      = habit.streakCount ?? 0;

  // Fetch current user once (needed for badge check context and level display)
  const currentUser = await User.findById(userId).select("xp level badges").lean();
  if (!currentUser) return null;
  const prevLevel = currentUser.level;
  const prevXp    = currentUser.xp;

  let xpDelta = 0;

  if (existing) {
    // ── Uncomplete ────────────────────────────────────────────────────────
    // Refund exactly the XP that was stored when the log was created.
    // This is idempotent: the log carries the "receipt" of what was given.
    xpDelta = -(existing.xpEarned ?? habit.xpValue);

    await HabitLog.deleteOne({ habitId, dateKey });

    const remainingLogs = await HabitLog.find(
      { habitId, skipped: { $ne: true } },
      { dateKey: 1, _id: 0 },
    ).lean();
    const remainingKeys = remainingLogs.map((l) => l.dateKey);

    const { streakCount, longestStreak, lastCompletedAt } =
      computeStreakAfterRemove(remainingKeys, config, todayKey, gracePeriods);

    habit.streakCount = streakCount;
    habit.longestStreak = Math.max(longestStreak, habit.longestStreak ?? 0);
    habit.lastCompletedAt = lastCompletedAt ?? undefined;
    habit.totalCompletions = Math.max(0, prevCompletions - 1);
  } else {
    // ── Complete ──────────────────────────────────────────────────────────
    // Fetch all logs first so the streak engine sees the full history
    // including the one we're about to create.
    // We create the log AFTER computing streak-after-add so we can pass
    // the final streakCount into calculateXp for the multiplier.
    const allLogs = await HabitLog.find(
      { habitId, skipped: { $ne: true } },
      { dateKey: 1, _id: 0 },
    ).lean();
    const allKeys = [...allLogs.map((l) => l.dateKey), dateKey];

    const current = {
      streakCount: habit.streakCount ?? 0,
      longestStreak: habit.longestStreak ?? 0,
      lastCompletedAt: habit.lastCompletedAt
        ? habit.lastCompletedAt.toISOString().slice(0, 10)
        : null,
    };

    const { streakCount, longestStreak, lastCompletedAt } = computeStreakAfterAdd(
      current,
      dateKey,
      todayKey,
      config,
      allKeys,
      gracePeriods,
    );

    // XP with streak multiplier (new streak is authoritative)
    xpDelta = calculateXp(habit.xpValue, streakCount);

    await HabitLog.create({
      habitId,
      userId,
      dateKey,
      completedAt: new Date(),
      xpEarned: xpDelta,
    });

    habit.streakCount = streakCount;
    habit.longestStreak = longestStreak;
    habit.lastCompletedAt = lastCompletedAt ? new Date(lastCompletedAt) : undefined;
    habit.totalCompletions = prevCompletions + 1;
  }

  await habit.save();

  // ── Apply XP + level ──────────────────────────────────────────────────────
  const { newXp, newLevel, leveledUp, previousLevel } =
    await userRepository.applyXpAndLevel(userId, xpDelta);

  // ── Badge check (only on completions, not uncompletes) ────────────────────
  let newBadges = [];
  if (xpDelta > 0) {
    const alreadyEarnedIds = (currentUser.badges ?? []).map((b) =>
      b.badgeId.toString(),
    );

    newBadges = await checkAndAwardBadges(userId, {
      habitStreakCount:      habit.streakCount,
      habitTotalCompletions: habit.totalCompletions,
      habitCompletionRate:   habit.completionRate ?? 0,
      habitCategory:         habit.category,
      userLevel:             newLevel,
      userXp:                newXp,
      alreadyEarnedIds,
    });
  }

  // ── Milestone detection ───────────────────────────────────────────────────
  const milestones = detectMilestones(
    { completions: prevCompletions, streak: prevStreak, level: prevLevel },
    { completions: habit.totalCompletions, streak: habit.streakCount, level: newLevel },
  );

  // Badge XP was added by checkAndAwardBadges; re-read for accurate total
  const finalXp = newBadges.length > 0
    ? newXp + newBadges.reduce((s, b) => s + (b.xpReward ?? 0), 0)
    : newXp;

  return {
    habit: habit.toObject(),
    gamification: {
      xpGained: xpDelta,
      newXp: finalXp,
      previousLevel,
      newLevel,
      leveledUp,
      newBadges: newBadges.map((b) => ({
        _id:           b._id,
        name:          b.name,
        description:   b.description,
        unlockMessage: b.unlockMessage,
        icon:          b.icon,
        tier:          b.tier,
        xpReward:      b.xpReward,
      })),
      milestones,
    },
  };
}
