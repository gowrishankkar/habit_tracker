/**
 * Gamification Engine — pure functions, no I/O.
 *
 * All XP calculation, level progression, and milestone detection logic
 * lives here so it can be unit-tested in isolation and is decoupled from
 * the database.  The service layer imports these and handles persistence.
 *
 * Key decisions:
 * ─────────────
 * • Streak multipliers incentivise consistency without making early XP
 *   feel worthless.  The curve tops out at 2× for 100-day streaks.
 *
 * • Level formula: level = 1 + floor(√(totalXp / 100))
 *   → Level 2 requires 100 XP (10 medium completions)
 *   → Level 3 requires 400 XP  (~20 after multipliers)
 *   → Each successive level requires more XP (quadratic wall).
 *   This matches the shared `xpForLevel` constant which gives the threshold
 *   to advance PAST a given level: xpForLevel(n) = n² × 100.
 *
 * • Milestones are emitted as opaque string codes (e.g. "streak_7") so
 *   the client can match them against a display map without knowing the
 *   threshold values.
 *
 * • Idempotency guarantee: this module only computes; it never writes.
 *   XP is stored on HabitLog.xpEarned so uncompleting always refunds the
 *   exact amount that was granted, regardless of later value changes.
 */

// ─────────────────────────────────────────────────────────────────────────────
// XP multipliers — streak milestone → multiplier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sorted descending so the first matching threshold wins.
 * Values chosen to feel meaningful without being pay-to-win:
 *   3 days  → +10% (getting started)
 *   7 days  → +25% (full week)
 *   30 days → +75% (full month)
 *   100 days → 2× (legendary consistency)
 */
export const STREAK_MULTIPLIERS = [
  { threshold: 100, multiplier: 2.0 },
  { threshold:  30, multiplier: 1.75 },
  { threshold:  14, multiplier: 1.5 },
  { threshold:   7, multiplier: 1.25 },
  { threshold:   3, multiplier: 1.1 },
];

/**
 * Calculate the final XP earned for a single completion.
 *
 * @param {number} baseXp     — habit.xpValue (set by difficulty at creation time)
 * @param {number} streakCount — current streak AFTER this completion
 * @returns {number}           — integer XP (always ≥ baseXp)
 */
export function calculateXp(baseXp, streakCount) {
  const entry = STREAK_MULTIPLIERS.find((m) => streakCount >= m.threshold);
  if (!entry) return baseXp;
  return Math.floor(baseXp * entry.multiplier);
}

// ─────────────────────────────────────────────────────────────────────────────
// Level formula
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Total XP required to advance past level `level`.
 * xpForLevel(1) = 100, xpForLevel(2) = 400, xpForLevel(n) = n² × 100.
 *
 * @param {number} level  (≥ 1)
 * @returns {number}
 */
export function xpForLevel(level) {
  return level * level * 100;
}

/**
 * Derive the user's current level from their cumulative XP.
 *
 * level = max(1, 1 + floor(√(totalXp / 100)))
 *
 * Examples:
 *   0 XP   → level 1
 *   99 XP  → level 1
 *   100 XP → level 2   (threshold: xpForLevel(1) = 100)
 *   400 XP → level 3   (threshold: xpForLevel(2) = 400)
 *   900 XP → level 4
 *
 * @param {number} totalXp
 * @returns {number}
 */
export function calculateLevel(totalXp) {
  if (totalXp <= 0) return 1;
  return Math.max(1, 1 + Math.floor(Math.sqrt(totalXp / 100)));
}

/**
 * Returns progress within the current level as an object.
 *
 * @param {number} totalXp
 * @returns {{ level: number, earned: number, needed: number, percent: number }}
 *
 * `earned` = XP accumulated in the current level.
 * `needed` = XP gap for this entire level (to reach the next level).
 * `percent` = 0–100.
 */
export function xpProgressInLevel(totalXp) {
  const level = calculateLevel(totalXp);
  // XP threshold at start of current level = xpForLevel(level - 1)
  // For level 1: xpForLevel(0) = 0
  const levelStartXp = level <= 1 ? 0 : xpForLevel(level - 1);
  const levelEndXp   = xpForLevel(level);
  const needed = levelEndXp - levelStartXp;
  const earned = Math.max(0, totalXp - levelStartXp);
  const percent = Math.round((earned / needed) * 100);
  return { level, earned, needed, percent };
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestone detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Completion count milestones — checked against habit.totalCompletions.
 * Using per-habit counts makes "100 completions" achievable and specific
 * ("I've run 100 times") rather than a vague cross-habit aggregate.
 */
export const COMPLETION_MILESTONES = [1, 7, 30, 100, 365, 1000];

/**
 * Streak milestones — checked against habit.streakCount.
 */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365];

/**
 * Level milestones — every level is celebrated (handled via leveledUp flag).
 * Special shout-outs at round numbers:
 */
export const NOTABLE_LEVELS = new Set([5, 10, 25, 50, 100]);

/**
 * Compare before/after state and return crossed milestone codes.
 *
 * @param {{ completions: number, streak: number, level: number }} prev
 * @param {{ completions: number, streak: number, level: number }} next
 * @returns {string[]}  — array of milestone code strings, empty if none crossed
 *
 * Example output: ["first_completion", "streak_7", "level_up", "level_5"]
 */
export function detectMilestones(prev, next) {
  const codes = [];

  // Completion milestones
  for (const threshold of COMPLETION_MILESTONES) {
    if (prev.completions < threshold && next.completions >= threshold) {
      codes.push(threshold === 1 ? "first_completion" : `completions_${threshold}`);
    }
  }

  // Streak milestones
  for (const threshold of STREAK_MILESTONES) {
    if (prev.streak < threshold && next.streak >= threshold) {
      codes.push(`streak_${threshold}`);
    }
  }

  // Level-up
  if (next.level > prev.level) {
    codes.push("level_up");
    // Special level shout-outs
    for (let lvl = prev.level + 1; lvl <= next.level; lvl++) {
      if (NOTABLE_LEVELS.has(lvl)) codes.push(`level_${lvl}`);
    }
  }

  return codes;
}
