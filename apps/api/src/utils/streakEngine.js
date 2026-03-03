/**
 * Streak Calculation Engine
 * ─────────────────────────
 * Pure, side-effect-free functions. No Mongoose, no I/O.
 * All state (dateKeys, habit config) is passed in as arguments so every
 * function is deterministic and trivially testable.
 *
 * ── Terminology ──────────────────────────────────────────────────────────────
 *
 *   dateKey     — "YYYY-MM-DD" string in the user's LOCAL timezone.
 *                 This is the canonical date unit everywhere in the system.
 *                 All comparison logic operates on dateKey strings only —
 *                 never on raw Date objects — to stay timezone-safe.
 *
 *   period      — The atomic streak unit for a given frequency:
 *                   daily   → 1 calendar day
 *                   weekly  → 1 ISO week (Mon–Sun or Sun–Sat per weekStartsOn)
 *                   custom  → 1 calendar day (same as daily)
 *
 *   streak      — The count of consecutive periods in which the habit's
 *                 targetCount was satisfied (≥1 completion, or the user
 *                 consumed a grace slot).
 *
 *   grace       — A premium-tier skip allowance. A missed period does NOT
 *                 break the streak if the user has remaining grace slots
 *                 for their subscription tier.
 *
 * ── Timezone strategy ────────────────────────────────────────────────────────
 *
 *   Problem: "yesterday" means different UTC ranges for different users.
 *   A user in UTC-12 completing at 23:00 on Monday sends UTC Tuesday 11:00.
 *   If we compare UTC dates, the server thinks it's Tuesday and breaks the streak.
 *
 *   Solution: the CLIENT sends a dateKey computed in the user's local timezone.
 *   The server trusts dateKey strings and never converts them back to UTC Date
 *   objects for comparison purposes.
 *
 *   Timezone-change edge case: if a user moves from UTC+9 to UTC-5, their
 *   "today" dateKey jumps backwards by 14 hours. This can create a gap in
 *   their completion history for a period that never existed in their new
 *   timezone. The recalculateStreak() function handles this correctly because
 *   it looks at actual completions — it doesn't assume what "should" exist.
 *
 * ── Backdated completion edge case ───────────────────────────────────────────
 *
 *   A user can log a completion for "2025-03-01" on "2025-03-10".
 *   Simple +1/-1 counters would give the wrong answer.
 *   recalculateStreak() re-derives the streak from the full sorted dateKey list,
 *   so backdated entries are handled correctly with no special cases.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Date utilities (all operate on "YYYY-MM-DD" strings)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a "YYYY-MM-DD" string into { year, month (1-12), day }.
 * Intentionally avoids `new Date()` to prevent UTC offset surprises.
 *
 * @param {string} dateKey
 * @returns {{ year: number, month: number, day: number }}
 */
export function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

/**
 * Format { year, month, day } back to "YYYY-MM-DD".
 *
 * @param {number} year
 * @param {number} month  1-indexed
 * @param {number} day
 * @returns {string}
 */
export function formatDateKey(year, month, day) {
  return [
    String(year),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

/**
 * Returns the number of days between two dateKeys.
 * Positive if b > a (b is later), negative if b < a.
 *
 * Uses a UTC Date constructed from the parsed parts (no timezone conversion
 * is involved because we explicitly set year/month/day at midnight UTC).
 *
 * @param {string} a  earlier dateKey
 * @param {string} b  later dateKey
 * @returns {number}  integer days
 */
export function daysBetween(a, b) {
  const toMs = (dk) => {
    const { year, month, day } = parseDateKey(dk);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toMs(b) - toMs(a)) / 86_400_000);
}

/**
 * Add `n` days to a dateKey and return a new dateKey.
 * Correctly handles month/year rollovers.
 *
 * @param {string} dateKey
 * @param {number} n  may be negative (subtract days)
 * @returns {string}
 */
export function addDays(dateKey, n) {
  const { year, month, day } = parseDateKey(dateKey);
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return formatDateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Returns the ISO week number (1–53) for a dateKey.
 * ISO week: week starts on Monday, week 1 = week containing Jan 4.
 *
 * @param {string} dateKey
 * @returns {number}
 */
export function isoWeekNumber(dateKey) {
  const { year, month, day } = parseDateKey(dateKey);
  const d = new Date(Date.UTC(year, month - 1, day));
  // Adjust to nearest Thursday (ISO weeks are defined by Thursday)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
}

/**
 * Returns the ISO week year for a dateKey (may differ from calendar year
 * in the last days of December or first days of January).
 *
 * @param {string} dateKey
 * @returns {number}
 */
export function isoWeekYear(dateKey) {
  const { year, month, day } = parseDateKey(dateKey);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

/**
 * Returns a canonical string identifying the ISO week: "YYYY-Www"
 * e.g. "2025-W03". Used as the streak unit key for weekly habits.
 *
 * @param {string} dateKey
 * @returns {string}
 */
export function weekKey(dateKey) {
  const w = String(isoWeekNumber(dateKey)).padStart(2, "0");
  return `${isoWeekYear(dateKey)}-W${w}`;
}

/**
 * Returns the day-of-week number for a dateKey.
 * 0 = Sunday, 1 = Monday … 6 = Saturday (matches JS getUTCDay()).
 *
 * @param {string} dateKey
 * @returns {number}
 */
export function dayOfWeek(dateKey) {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Compare two dateKeys lexicographically.
 * Safe because ISO 8601 strings sort identically to chronological order.
 *
 * @returns {-1 | 0 | 1}
 */
export function compareDateKeys(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Period utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a sorted (ascending) array of completed dateKeys and a habit config,
 * return an array of *period keys* that have at least `targetCount` completions.
 *
 * Period key:
 *   daily / custom  → the dateKey itself ("2025-03-10")
 *   weekly          → ISO week string ("2025-W10")
 *
 * @param {string[]} completedDateKeys  sorted ascending, no duplicates
 * @param {HabitConfig}  habit
 * @returns {string[]}  sorted ascending period keys that are "satisfied"
 */
export function getSatisfiedPeriods(completedDateKeys, habit) {
  const { frequency, targetDays, targetCount = 1 } = habit;

  if (frequency === "daily") {
    // Each date is its own period. Every completion satisfies its period.
    return [...completedDateKeys];
  }

  if (frequency === "weekly") {
    // Group completions by ISO week. A week is satisfied when it has
    // ≥ targetCount completions on the correct targetDays (if specified).
    const weekBuckets = new Map();

    for (const dk of completedDateKeys) {
      const dow = dayOfWeek(dk);
      // If targetDays is set, only count completions on the right days.
      if (targetDays.length > 0 && !targetDays.includes(dow)) continue;

      const wk = weekKey(dk);
      weekBuckets.set(wk, (weekBuckets.get(wk) ?? 0) + 1);
    }

    return [...weekBuckets.entries()]
      .filter(([, count]) => count >= targetCount)
      .map(([wk]) => wk)
      .sort();
  }

  if (frequency === "custom") {
    // Custom = "only on specific days of the week, daily streak on those days".
    // A period is one occurrence of a target day.
    // A completion satisfies a period only if it falls on a targetDay.
    if (targetDays.length === 0) return [...completedDateKeys];

    return completedDateKeys.filter((dk) => targetDays.includes(dayOfWeek(dk)));
  }

  return [...completedDateKeys];
}

/**
 * Given two consecutive satisfied period keys (sorted ascending), determine
 * whether they are adjacent (i.e. no gap between them).
 *
 * For daily periods: adjacent = exactly 1 day apart.
 * For weekly periods: adjacent = consecutive ISO weeks (week numbers differ by 1,
 *   wrapping correctly at year boundaries).
 *
 * @param {string} prev  earlier period key
 * @param {string} curr  later period key
 * @param {"daily"|"weekly"|"custom"} frequency
 * @returns {boolean}
 */
export function periodsAreAdjacent(prev, curr, frequency) {
  if (frequency === "weekly") {
    // Compare week numbers numerically, handling year-wrap (W52/W53 → W01)
    const parseWeek = (wk) => {
      const [y, w] = wk.split("-W");
      return { year: Number(y), week: Number(w) };
    };
    const p = parseWeek(prev);
    const c = parseWeek(curr);

    if (p.year === c.year) return c.week - p.week === 1;

    // Year boundary: prev must be the last week of its year, curr must be W01
    const isLastWeek = (yw) => {
      // The last ISO week is either W52 or W53 depending on the year.
      // A year has 53 weeks if Jan 1 is Thursday, or if it's a leap year
      // starting on Wednesday.
      const dec28 = formatDateKey(yw.year, 12, 28);
      return isoWeekNumber(dec28) === yw.week;
    };
    return c.year === p.year + 1 && c.week === 1 && isLastWeek(p);
  }

  // daily / custom: adjacent = exactly 1 day apart
  if (frequency === "custom") {
    // For custom habits, "adjacent" means the next occurrence of a target day,
    // not necessarily the very next calendar day.
    // We return true regardless of gap size between target days.
    // The streak calculation handles custom gaps via getExpectedPeriodsBetween.
    return true;
  }

  return daysBetween(prev, curr) === 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core streak calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} HabitConfig
 * @property {"daily"|"weekly"|"custom"} frequency
 * @property {number[]} targetDays  0=Sun…6=Sat, empty=every day
 * @property {number}   [targetCount=1]  completions required per period
 */

/**
 * @typedef {Object} StreakResult
 * @property {number}   streakCount     current consecutive satisfied periods
 * @property {number}   longestStreak   all-time max streak
 * @property {string|null} lastCompletedAt  most recent satisfied dateKey
 */

/**
 * Recalculate streak from scratch given the full sorted list of completed
 * dateKeys and the habit's configuration.
 *
 * This is the authoritative calculation — used after any mutation that could
 * change the streak (add, delete, or backdate a completion).
 *
 * Algorithm:
 *   1. Convert dateKeys → satisfied period keys
 *   2. Walk the period keys in ascending order
 *   3. Track a "run" — consecutive adjacent periods
 *   4. When a gap is found, the run ends
 *   5. Record the longest run seen; the current run is the streak
 *
 * Time complexity: O(n log n) for the sort + O(n) for the walk = O(n log n)
 * n = number of completions (bounded in practice by ~1000/habit/3 years)
 *
 * @param {string[]} completedDateKeys  ALL completed dateKeys (unsorted ok)
 * @param {HabitConfig} habit
 * @param {string} todayKey  "YYYY-MM-DD" in user's local timezone
 * @param {number} [gracePeriods=0]  how many missed periods are forgiven
 * @returns {StreakResult}
 */
export function recalculateStreak(
  completedDateKeys,
  habit,
  todayKey,
  gracePeriods = 0,
) {
  if (completedDateKeys.length === 0) {
    return { streakCount: 0, longestStreak: 0, lastCompletedAt: null };
  }

  // Step 1: deduplicate and sort ascending
  const sorted = [...new Set(completedDateKeys)].sort(compareDateKeys);

  // Step 2: map to satisfied period keys
  const periods = getSatisfiedPeriods(sorted, habit);

  if (periods.length === 0) {
    return { streakCount: 0, longestStreak: 0, lastCompletedAt: null };
  }

  // Step 3: walk and find runs, respecting grace periods
  let longestStreak = 1;
  let currentRun = 1;
  let graceUsed = 0;

  for (let i = 1; i < periods.length; i++) {
    if (periodsAreAdjacent(periods[i - 1], periods[i], habit.frequency)) {
      currentRun++;
      graceUsed = 0; // reset grace counter on a real completion
    } else {
      // There is a gap. Count the missing periods between them.
      const gap = countMissingPeriods(periods[i - 1], periods[i], habit);

      if (gracePeriods > 0 && gap <= gracePeriods - graceUsed) {
        // Grace absorbs this gap — streak continues
        graceUsed += gap;
        currentRun++;
      } else {
        // Gap is too large — streak resets
        longestStreak = Math.max(longestStreak, currentRun);
        currentRun = 1;
        graceUsed = 0;
      }
    }
    longestStreak = Math.max(longestStreak, currentRun);
  }

  // Step 4: determine if the current streak is still active
  // (i.e. the last satisfied period connects to "today or yesterday")
  const lastPeriod = periods[periods.length - 1];
  const streakIsActive = isStreakActive(lastPeriod, todayKey, habit);
  const streakCount = streakIsActive ? currentRun : 0;

  return {
    streakCount,
    longestStreak,
    lastCompletedAt: sorted[sorted.length - 1],
  };
}

/**
 * Count the number of required (non-grace) periods between two period keys.
 * Returns 0 if they are adjacent, 1 if there is one missing period, etc.
 *
 * @param {string} prev
 * @param {string} curr
 * @param {HabitConfig} habit
 * @returns {number}
 */
export function countMissingPeriods(prev, curr, habit) {
  if (habit.frequency === "weekly") {
    const parseWeek = (wk) => {
      const [y, w] = wk.split("-W");
      return { year: Number(y), week: Number(w) };
    };
    const p = parseWeek(prev);
    const c = parseWeek(curr);
    // Total weeks spanned minus 1 (the gap between them)
    // Approximate: each year has ~52.18 weeks
    const totalWeeks = (c.year - p.year) * 52 + (c.week - p.week);
    return Math.max(0, totalWeeks - 1);
  }

  if (habit.frequency === "custom") {
    if (habit.targetDays.length === 0) {
      return Math.max(0, daysBetween(prev, curr) - 1);
    }
    // Count how many target days fall strictly between prev and curr
    let count = 0;
    let cursor = addDays(prev, 1);
    while (cursor < curr) {
      if (habit.targetDays.includes(dayOfWeek(cursor))) count++;
      cursor = addDays(cursor, 1);
    }
    return count;
  }

  // daily: missing periods = calendar days in gap - 1
  return Math.max(0, daysBetween(prev, curr) - 1);
}

/**
 * Determine whether a streak ending on `lastPeriod` is still "active" today.
 *
 * A streak is active if the last satisfied period is either:
 *   - The current period (user already completed today/this week)
 *   - The immediately preceding period (user hasn't completed yet today/this
 *     week, but they still have time to do so without breaking the streak)
 *
 * @param {string} lastPeriod  last satisfied period key
 * @param {string} todayKey   "YYYY-MM-DD" in user's local timezone
 * @param {HabitConfig} habit
 * @returns {boolean}
 */
export function isStreakActive(lastPeriod, todayKey, habit) {
  if (habit.frequency === "weekly") {
    const todayWeek = weekKey(todayKey);
    const prevWeek = getPreviousWeekKey(todayWeek);
    return lastPeriod === todayWeek || lastPeriod === prevWeek;
  }

  if (habit.frequency === "custom") {
    if (habit.targetDays.length === 0) {
      const gap = daysBetween(lastPeriod, todayKey);
      return gap === 0 || gap === 1;
    }
    // Custom: streak is active if:
    // - Last period was on a target day AND
    // - No target day has been missed between lastPeriod and today
    const missedTarget = hasUncompletedTargetDayBetween(
      lastPeriod,
      todayKey,
      habit.targetDays,
    );
    return !missedTarget;
  }

  // daily: active if last completion was today or yesterday
  const gap = daysBetween(lastPeriod, todayKey);
  return gap === 0 || gap === 1;
}

/**
 * Returns the ISO week key for the week immediately preceding the given week key.
 *
 * @param {string} wk  e.g. "2025-W01"
 * @returns {string}   e.g. "2024-W52"
 */
export function getPreviousWeekKey(wk) {
  const [y, w] = wk.split("-W").map(Number);
  if (w > 1) return `${y}-W${String(w - 1).padStart(2, "0")}`;

  // Week 1 → last week of previous year
  const dec28Prev = formatDateKey(y - 1, 12, 28);
  const lastWeekNum = isoWeekNumber(dec28Prev);
  return `${y - 1}-W${String(lastWeekNum).padStart(2, "0")}`;
}

/**
 * Returns true if any targetDay falls strictly between startKey (exclusive)
 * and todayKey (exclusive) with no completion recorded on that day.
 *
 * Used for custom-frequency streak-active checks.
 *
 * @param {string}   startKey   last completed dateKey
 * @param {string}   todayKey
 * @param {number[]} targetDays
 * @returns {boolean}
 */
export function hasUncompletedTargetDayBetween(startKey, todayKey, targetDays) {
  let cursor = addDays(startKey, 1);
  while (cursor < todayKey) {
    if (targetDays.includes(dayOfWeek(cursor))) return true;
    cursor = addDays(cursor, 1);
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Incremental update (fast path for single-day toggles)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the new streak state after a single completion is ADDED.
 *
 * Fast path: avoids re-walking the entire history when the new completion
 * is "today" (the most common case). Falls back to full recalculation for
 * backdated completions.
 *
 * @param {StreakResult} current   current denormalized streak state
 * @param {string}       newDateKey  dateKey being added
 * @param {string}       todayKey
 * @param {HabitConfig}  habit
 * @param {string[]}     allDateKeys  full list AFTER adding newDateKey
 * @param {number}       [gracePeriods=0]
 * @returns {StreakResult}
 */
export function computeStreakAfterAdd(
  current,
  newDateKey,
  todayKey,
  habit,
  allDateKeys,
  gracePeriods = 0,
) {
  const isBackdated =
    current.lastCompletedAt !== null &&
    compareDateKeys(newDateKey, current.lastCompletedAt) < 0;

  // Backdated completions or inserting into the middle of the history
  // require full recalculation — no safe shortcut.
  if (isBackdated) {
    return recalculateStreak(allDateKeys, habit, todayKey, gracePeriods);
  }

  // Fast path: new completion is today or in the future relative to last
  const newStreak = current.streakCount + 1;
  return {
    streakCount: newStreak,
    longestStreak: Math.max(current.longestStreak, newStreak),
    lastCompletedAt: newDateKey,
  };
}

/**
 * Compute the new streak state after a single completion is REMOVED.
 *
 * Removing any completion always requires a full recalculation because
 * the removed entry might have been in the middle of the active run.
 *
 * @param {string[]} remainingDateKeys  full list AFTER removing the entry
 * @param {HabitConfig} habit
 * @param {string}  todayKey
 * @param {number}  [gracePeriods=0]
 * @returns {StreakResult}
 */
export function computeStreakAfterRemove(
  remainingDateKeys,
  habit,
  todayKey,
  gracePeriods = 0,
) {
  return recalculateStreak(remainingDateKeys, habit, todayKey, gracePeriods);
}

// ─────────────────────────────────────────────────────────────────────────────
// Streak health check (used by nightly cron)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given the current stored streakCount and the last completed dateKey,
 * determine whether the streak is still valid as of `todayKey`.
 *
 * Used by the streak-check cron to reset stale streaks without reloading
 * every HabitLog document — only the denormalized Habit fields are needed.
 *
 * @param {number}      streakCount
 * @param {string|null} lastCompletedAt
 * @param {string}      todayKey
 * @param {HabitConfig} habit
 * @param {number}      [gracePeriods=0]
 * @returns {{ isActive: boolean, shouldReset: boolean }}
 */
export function checkStreakHealth(
  streakCount,
  lastCompletedAt,
  todayKey,
  habit,
  gracePeriods = 0,
) {
  if (streakCount === 0 || lastCompletedAt === null) {
    return { isActive: false, shouldReset: false };
  }

  const lastPeriod =
    habit.frequency === "weekly"
      ? weekKey(lastCompletedAt)
      : lastCompletedAt;

  const active = isStreakActive(lastPeriod, todayKey, habit);

  if (active) return { isActive: true, shouldReset: false };

  // Streak is no longer active. Check if grace covers the gap.
  const todayPeriod =
    habit.frequency === "weekly" ? weekKey(todayKey) : todayKey;

  const missing = countMissingPeriods(lastPeriod, todayPeriod, habit);

  if (gracePeriods > 0 && missing <= gracePeriods) {
    return { isActive: true, shouldReset: false };
  }

  return { isActive: false, shouldReset: true };
}
