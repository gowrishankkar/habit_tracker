/**
 * Streak Engine — Test Suite
 *
 * Run with:  node --test apps/api/src/utils/streakEngine.test.js
 *
 * Uses Node.js built-in test runner (v18+).
 * Zero external dependencies.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseDateKey,
  formatDateKey,
  daysBetween,
  addDays,
  isoWeekNumber,
  weekKey,
  dayOfWeek,
  compareDateKeys,
  getSatisfiedPeriods,
  periodsAreAdjacent,
  countMissingPeriods,
  isStreakActive,
  getPreviousWeekKey,
  hasUncompletedTargetDayBetween,
  recalculateStreak,
  computeStreakAfterAdd,
  computeStreakAfterRemove,
  checkStreakHealth,
} from "./streakEngine.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a sorted dateKey list from an array of offsets relative to an anchor. */
function daysFrom(anchor, offsets) {
  return offsets.map((n) => addDays(anchor, n)).sort();
}

const DAILY = { frequency: "daily", targetDays: [], targetCount: 1 };
const WEEKLY = { frequency: "weekly", targetDays: [], targetCount: 1 };
const WEEKLY_3X = { frequency: "weekly", targetDays: [], targetCount: 3 };
const MON_WED_FRI = { frequency: "custom", targetDays: [1, 3, 5], targetCount: 1 };
const WEEKENDS = { frequency: "custom", targetDays: [0, 6], targetCount: 1 };

// ─────────────────────────────────────────────────────────────────────────────
// Date utilities
// ─────────────────────────────────────────────────────────────────────────────

describe("parseDateKey", () => {
  it("parses a normal date", () => {
    assert.deepEqual(parseDateKey("2025-03-15"), { year: 2025, month: 3, day: 15 });
  });

  it("parses January 1", () => {
    assert.deepEqual(parseDateKey("2025-01-01"), { year: 2025, month: 1, day: 1 });
  });

  it("parses December 31", () => {
    assert.deepEqual(parseDateKey("2024-12-31"), { year: 2024, month: 12, day: 31 });
  });
});

describe("formatDateKey", () => {
  it("pads single-digit month and day", () => {
    assert.equal(formatDateKey(2025, 3, 5), "2025-03-05");
  });

  it("does not pad double-digit values", () => {
    assert.equal(formatDateKey(2025, 12, 31), "2025-12-31");
  });
});

describe("daysBetween", () => {
  it("returns 0 for same day", () => {
    assert.equal(daysBetween("2025-03-10", "2025-03-10"), 0);
  });

  it("returns 1 for consecutive days", () => {
    assert.equal(daysBetween("2025-03-10", "2025-03-11"), 1);
  });

  it("returns 7 for a week apart", () => {
    assert.equal(daysBetween("2025-03-10", "2025-03-17"), 7);
  });

  it("returns negative when b < a", () => {
    assert.equal(daysBetween("2025-03-17", "2025-03-10"), -7);
  });

  it("crosses month boundary correctly", () => {
    assert.equal(daysBetween("2025-01-28", "2025-02-04"), 7);
  });

  it("crosses year boundary correctly", () => {
    assert.equal(daysBetween("2024-12-30", "2025-01-02"), 3);
  });

  it("handles leap year (Feb 28 → Mar 1 = 2 days in 2024)", () => {
    assert.equal(daysBetween("2024-02-28", "2024-03-01"), 2);
  });

  it("handles non-leap year (Feb 28 → Mar 1 = 1 day in 2025)", () => {
    assert.equal(daysBetween("2025-02-28", "2025-03-01"), 1);
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    assert.equal(addDays("2025-03-10", 5), "2025-03-15");
  });

  it("subtracts days with negative n", () => {
    assert.equal(addDays("2025-03-10", -3), "2025-03-07");
  });

  it("rolls over month boundary", () => {
    assert.equal(addDays("2025-01-30", 3), "2025-02-02");
  });

  it("rolls over year boundary", () => {
    assert.equal(addDays("2024-12-31", 1), "2025-01-01");
  });

  it("handles leap day", () => {
    assert.equal(addDays("2024-02-28", 1), "2024-02-29");
    assert.equal(addDays("2024-02-29", 1), "2024-03-01");
  });
});

describe("isoWeekNumber", () => {
  it("Jan 1 2025 is in week 1", () => {
    assert.equal(isoWeekNumber("2025-01-01"), 1);
  });

  it("Dec 28 2025 is in week 52", () => {
    assert.equal(isoWeekNumber("2025-12-28"), 52);
  });

  it("Dec 29 2025 is in week 1 of 2026 (ISO edge case)", () => {
    // 2025-12-29 is a Monday — start of ISO week 1 of 2026
    assert.equal(isoWeekNumber("2025-12-29"), 1);
  });

  it("Jan 1 2015 is in week 1 of 2015", () => {
    assert.equal(isoWeekNumber("2015-01-01"), 1);
  });
});

describe("weekKey", () => {
  it("formats week key correctly", () => {
    assert.equal(weekKey("2025-03-10"), "2025-W11");
  });

  it("handles year-end ISO boundary (Dec 29 2025 → week 01 of 2026)", () => {
    assert.equal(weekKey("2025-12-29"), "2026-W01");
  });
});

describe("dayOfWeek", () => {
  it("2025-03-10 is a Monday (1)", () => {
    assert.equal(dayOfWeek("2025-03-10"), 1);
  });

  it("2025-03-09 is a Sunday (0)", () => {
    assert.equal(dayOfWeek("2025-03-09"), 0);
  });

  it("2025-03-15 is a Saturday (6)", () => {
    assert.equal(dayOfWeek("2025-03-15"), 6);
  });
});

describe("getPreviousWeekKey", () => {
  it("returns previous week within same year", () => {
    assert.equal(getPreviousWeekKey("2025-W11"), "2025-W10");
  });

  it("wraps from W01 to last week of previous year", () => {
    const prev = getPreviousWeekKey("2025-W01");
    // 2024 has 52 ISO weeks
    assert.equal(prev, "2024-W52");
  });

  it("handles year with 53 weeks (2020)", () => {
    // 2020-W53 exists; 2021-W01 previous should be 2020-W53
    const prev = getPreviousWeekKey("2021-W01");
    assert.equal(prev, "2020-W53");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getSatisfiedPeriods
// ─────────────────────────────────────────────────────────────────────────────

describe("getSatisfiedPeriods — daily", () => {
  it("every completion is its own satisfied period", () => {
    const keys = ["2025-03-10", "2025-03-11", "2025-03-12"];
    assert.deepEqual(getSatisfiedPeriods(keys, DAILY), keys);
  });

  it("returns empty for no completions", () => {
    assert.deepEqual(getSatisfiedPeriods([], DAILY), []);
  });
});

describe("getSatisfiedPeriods — weekly (1x)", () => {
  it("one completion per week satisfies each week", () => {
    const keys = ["2025-03-10", "2025-03-17", "2025-03-24"];
    const result = getSatisfiedPeriods(keys, WEEKLY);
    assert.deepEqual(result, ["2025-W11", "2025-W12", "2025-W13"]);
  });

  it("multiple completions in same week = 1 satisfied period", () => {
    const keys = ["2025-03-10", "2025-03-11", "2025-03-12"];
    const result = getSatisfiedPeriods(keys, WEEKLY);
    assert.deepEqual(result, ["2025-W11"]);
  });

  it("returns empty when no completions", () => {
    assert.deepEqual(getSatisfiedPeriods([], WEEKLY), []);
  });
});

describe("getSatisfiedPeriods — weekly (3x)", () => {
  it("week with 3 completions is satisfied", () => {
    const keys = ["2025-03-10", "2025-03-11", "2025-03-12"];
    const result = getSatisfiedPeriods(keys, WEEKLY_3X);
    assert.deepEqual(result, ["2025-W11"]);
  });

  it("week with only 2 completions is NOT satisfied", () => {
    const keys = ["2025-03-10", "2025-03-11"];
    const result = getSatisfiedPeriods(keys, WEEKLY_3X);
    assert.deepEqual(result, []);
  });

  it("mixed weeks: only fully-satisfied weeks appear", () => {
    // W11: 3 completions (satisfied), W12: 2 completions (not satisfied)
    const keys = [
      "2025-03-10", "2025-03-11", "2025-03-12", // W11 ×3 ✓
      "2025-03-17", "2025-03-18",                 // W12 ×2 ✗
    ];
    const result = getSatisfiedPeriods(keys, WEEKLY_3X);
    assert.deepEqual(result, ["2025-W11"]);
  });
});

describe("getSatisfiedPeriods — custom Mon/Wed/Fri", () => {
  it("only counts completions on target days", () => {
    // 2025-03-10 = Mon, 2025-03-11 = Tue (off-day), 2025-03-12 = Wed
    const keys = ["2025-03-10", "2025-03-11", "2025-03-12"];
    const result = getSatisfiedPeriods(keys, MON_WED_FRI);
    assert.deepEqual(result, ["2025-03-10", "2025-03-12"]);
  });

  it("discards all completions on non-target days", () => {
    // Sunday and Saturday only — MON_WED_FRI should return nothing
    const keys = ["2025-03-09", "2025-03-15"];
    const result = getSatisfiedPeriods(keys, MON_WED_FRI);
    assert.deepEqual(result, []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// periodsAreAdjacent
// ─────────────────────────────────────────────────────────────────────────────

describe("periodsAreAdjacent — daily", () => {
  it("consecutive days are adjacent", () => {
    assert.ok(periodsAreAdjacent("2025-03-10", "2025-03-11", "daily"));
  });

  it("two days apart are NOT adjacent", () => {
    assert.ok(!periodsAreAdjacent("2025-03-10", "2025-03-12", "daily"));
  });

  it("same day is NOT adjacent (gap = 0)", () => {
    assert.ok(!periodsAreAdjacent("2025-03-10", "2025-03-10", "daily"));
  });
});

describe("periodsAreAdjacent — weekly", () => {
  it("consecutive weeks within the same year are adjacent", () => {
    assert.ok(periodsAreAdjacent("2025-W10", "2025-W11", "weekly"));
  });

  it("non-consecutive weeks are NOT adjacent", () => {
    assert.ok(!periodsAreAdjacent("2025-W10", "2025-W12", "weekly"));
  });

  it("last week of year to first week of next year are adjacent (2024 W52 → 2025 W01)", () => {
    assert.ok(periodsAreAdjacent("2024-W52", "2025-W01", "weekly"));
  });

  it("last week of 53-week year to first week of next year (2020 W53 → 2021 W01)", () => {
    assert.ok(periodsAreAdjacent("2020-W53", "2021-W01", "weekly"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// countMissingPeriods
// ─────────────────────────────────────────────────────────────────────────────

describe("countMissingPeriods — daily", () => {
  it("adjacent days have 0 missing periods", () => {
    assert.equal(countMissingPeriods("2025-03-10", "2025-03-11", DAILY), 0);
  });

  it("one gap day = 1 missing period", () => {
    assert.equal(countMissingPeriods("2025-03-10", "2025-03-12", DAILY), 1);
  });

  it("one week gap = 6 missing periods", () => {
    assert.equal(countMissingPeriods("2025-03-10", "2025-03-17", DAILY), 6);
  });
});

describe("countMissingPeriods — weekly", () => {
  it("adjacent weeks have 0 missing periods", () => {
    assert.equal(countMissingPeriods("2025-W10", "2025-W11", WEEKLY), 0);
  });

  it("one skipped week = 1 missing period", () => {
    assert.equal(countMissingPeriods("2025-W10", "2025-W12", WEEKLY), 1);
  });

  it("two skipped weeks = 2 missing periods", () => {
    assert.equal(countMissingPeriods("2025-W10", "2025-W13", WEEKLY), 2);
  });
});

describe("countMissingPeriods — custom Mon/Wed/Fri", () => {
  it("Mon → Wed with only Tue between: 0 missing target days between Mon and Wed", () => {
    // Mon 10 → Wed 12: Tue 11 is between them but not a target day
    assert.equal(countMissingPeriods("2025-03-10", "2025-03-12", MON_WED_FRI), 0);
  });

  it("Mon → Fri with Wed skipped: 1 missing period (Wed)", () => {
    // Mon 10 → Fri 14: Wed 12 is between them and IS a target day
    assert.equal(countMissingPeriods("2025-03-10", "2025-03-14", MON_WED_FRI), 1);
  });

  it("Mon → next Mon: Wed and Fri are missing = 2", () => {
    assert.equal(countMissingPeriods("2025-03-10", "2025-03-17", MON_WED_FRI), 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isStreakActive
// ─────────────────────────────────────────────────────────────────────────────

describe("isStreakActive — daily", () => {
  it("active when last period is today", () => {
    assert.ok(isStreakActive("2025-03-10", "2025-03-10", DAILY));
  });

  it("active when last period was yesterday", () => {
    assert.ok(isStreakActive("2025-03-10", "2025-03-11", DAILY));
  });

  it("not active when last period was 2 days ago", () => {
    assert.ok(!isStreakActive("2025-03-09", "2025-03-11", DAILY));
  });

  it("not active after a week gap", () => {
    assert.ok(!isStreakActive("2025-03-03", "2025-03-10", DAILY));
  });
});

describe("isStreakActive — weekly", () => {
  it("active when last period is this week", () => {
    // todayKey is in W11
    assert.ok(isStreakActive("2025-W11", "2025-03-10", WEEKLY));
  });

  it("active when last period was last week", () => {
    // todayKey is in W11, last period is W10
    assert.ok(isStreakActive("2025-W10", "2025-03-10", WEEKLY));
  });

  it("not active when last period was 2 weeks ago", () => {
    assert.ok(!isStreakActive("2025-W09", "2025-03-10", WEEKLY));
  });
});

describe("isStreakActive — custom Mon/Wed/Fri", () => {
  it("active when last target day was Mon and today is Tue (no target day missed)", () => {
    // Mon = 2025-03-10, today = 2025-03-11 (Tue). Tue is not a target day.
    assert.ok(isStreakActive("2025-03-10", "2025-03-11", MON_WED_FRI));
  });

  it("not active when Wed (target day) was skipped: last = Mon, today = Thu", () => {
    // Mon = 2025-03-10, today = 2025-03-13 (Thu). Wed 12 is a target day → missed.
    assert.ok(!isStreakActive("2025-03-10", "2025-03-13", MON_WED_FRI));
  });

  it("active when last = Mon, today = Wed (the next target day, not yet past)", () => {
    // Mon = 2025-03-10, today = 2025-03-12 (Wed). Tue is between them but not a target.
    assert.ok(isStreakActive("2025-03-10", "2025-03-12", MON_WED_FRI));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// recalculateStreak — daily
// ─────────────────────────────────────────────────────────────────────────────

describe("recalculateStreak — daily", () => {
  it("no completions → streak 0", () => {
    const r = recalculateStreak([], DAILY, "2025-03-10");
    assert.deepEqual(r, { streakCount: 0, longestStreak: 0, lastCompletedAt: null });
  });

  it("single completion today → streak 1", () => {
    const r = recalculateStreak(["2025-03-10"], DAILY, "2025-03-10");
    assert.equal(r.streakCount, 1);
    assert.equal(r.longestStreak, 1);
    assert.equal(r.lastCompletedAt, "2025-03-10");
  });

  it("7 consecutive days ending today → streak 7", () => {
    const keys = daysFrom("2025-03-10", [-6, -5, -4, -3, -2, -1, 0]);
    const r = recalculateStreak(keys, DAILY, "2025-03-10");
    assert.equal(r.streakCount, 7);
    assert.equal(r.longestStreak, 7);
  });

  it("gap in middle: 3 days, 1 gap, 4 days → current streak 4", () => {
    const keys = [
      "2025-03-01", "2025-03-02", "2025-03-03", // run 1: 3
      // gap on 2025-03-04
      "2025-03-05", "2025-03-06", "2025-03-07", "2025-03-08", // run 2: 4
    ];
    const r = recalculateStreak(keys, DAILY, "2025-03-08");
    assert.equal(r.streakCount, 4);
    assert.equal(r.longestStreak, 4);
  });

  it("two gaps: longest streak is correctly identified", () => {
    const keys = [
      "2025-03-01", "2025-03-02", "2025-03-03",           // run 1: 3
      "2025-03-05", "2025-03-06", "2025-03-07", "2025-03-08", "2025-03-09", // run 2: 5
      "2025-03-11", "2025-03-12",                          // run 3: 2
    ];
    const r = recalculateStreak(keys, DAILY, "2025-03-12");
    assert.equal(r.streakCount, 2);    // current: run 3
    assert.equal(r.longestStreak, 5);  // best: run 2
  });

  it("completed yesterday but not today → streak still active", () => {
    const keys = daysFrom("2025-03-10", [-2, -1]);
    const r = recalculateStreak(keys, DAILY, "2025-03-10");
    assert.equal(r.streakCount, 2);
  });

  it("last completion 2 days ago → streak is dead", () => {
    const keys = daysFrom("2025-03-10", [-3, -2]);
    const r = recalculateStreak(keys, DAILY, "2025-03-10");
    assert.equal(r.streakCount, 0);
    assert.equal(r.longestStreak, 2);
  });

  it("accepts unsorted input and deduplicates", () => {
    const keys = ["2025-03-12", "2025-03-10", "2025-03-10", "2025-03-11"];
    const r = recalculateStreak(keys, DAILY, "2025-03-12");
    assert.equal(r.streakCount, 3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// recalculateStreak — weekly
// ─────────────────────────────────────────────────────────────────────────────

describe("recalculateStreak — weekly", () => {
  it("one completion per week for 4 consecutive weeks → streak 4", () => {
    // Mondays of W10–W13 of 2025
    const keys = ["2025-03-03", "2025-03-10", "2025-03-17", "2025-03-24"];
    const r = recalculateStreak(keys, WEEKLY, "2025-03-24");
    assert.equal(r.streakCount, 4);
    assert.equal(r.longestStreak, 4);
  });

  it("skipped one week → streak resets to 1", () => {
    // W10, W11, then skip W12, then W13
    const keys = ["2025-03-03", "2025-03-10", "2025-03-24"];
    const r = recalculateStreak(keys, WEEKLY, "2025-03-24");
    assert.equal(r.streakCount, 1);
    assert.equal(r.longestStreak, 2);
  });

  it("multiple completions in same week still count as 1 period", () => {
    const keys = [
      "2025-03-10", "2025-03-11", "2025-03-12", // all W11
      "2025-03-17",                               // W12
    ];
    const r = recalculateStreak(keys, WEEKLY, "2025-03-17");
    assert.equal(r.streakCount, 2);
  });

  it("incomplete week (not enough for targetCount=3) is NOT counted", () => {
    const keys = ["2025-03-10", "2025-03-11"]; // only 2 of required 3 in W11
    const r = recalculateStreak(keys, WEEKLY_3X, "2025-03-12");
    assert.equal(r.streakCount, 0);
  });

  it("streak active if completed this week (not just last week)", () => {
    const keys = ["2025-03-03", "2025-03-10"]; // W10 and W11
    const r = recalculateStreak(keys, WEEKLY, "2025-03-10"); // today = Mon of W11
    assert.equal(r.streakCount, 2);
  });

  it("streak active if completed last week and current week not yet over", () => {
    // Completed W10, today is Wed of W11 (no completion this week yet)
    const keys = ["2025-03-03"]; // W10
    const r = recalculateStreak(keys, WEEKLY, "2025-03-12"); // Wed of W11
    assert.equal(r.streakCount, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// recalculateStreak — custom (Mon/Wed/Fri)
// ─────────────────────────────────────────────────────────────────────────────

describe("recalculateStreak — custom Mon/Wed/Fri", () => {
  it("hitting all 3 target days in one week → streak 3", () => {
    const keys = ["2025-03-10", "2025-03-12", "2025-03-14"]; // Mon, Wed, Fri
    const r = recalculateStreak(keys, MON_WED_FRI, "2025-03-14");
    assert.equal(r.streakCount, 3);
  });

  it("missing Wed → streak resets at Fri: streak = 1", () => {
    // Mon completed, Wed SKIPPED, Fri completed
    const keys = ["2025-03-10", "2025-03-14"]; // Mon and Fri
    const r = recalculateStreak(keys, MON_WED_FRI, "2025-03-14");
    // Mon → Fri gap: Wed (Mar 12) is a missing target day → gap of 1
    // No grace: streak = 1 (just Fri)
    assert.equal(r.streakCount, 1);
    assert.equal(r.longestStreak, 1);
  });

  it("off-day completions are ignored entirely", () => {
    // Tue and Thu completions — not target days
    const keys = ["2025-03-11", "2025-03-13"];
    const r = recalculateStreak(keys, MON_WED_FRI, "2025-03-13");
    assert.equal(r.streakCount, 0);
  });

  it("streak across two weeks: Mon/Wed/Fri then Mon → 4 consecutive", () => {
    const keys = [
      "2025-03-10", "2025-03-12", "2025-03-14", // W11: Mon Wed Fri
      "2025-03-17",                               // W12: Mon
    ];
    const r = recalculateStreak(keys, MON_WED_FRI, "2025-03-17");
    assert.equal(r.streakCount, 4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grace periods
// ─────────────────────────────────────────────────────────────────────────────

describe("recalculateStreak — grace periods", () => {
  it("1 grace day absorbs a single missed day", () => {
    const keys = ["2025-03-10", "2025-03-12"]; // gap on Mar 11
    const r = recalculateStreak(keys, DAILY, "2025-03-12", 1);
    assert.equal(r.streakCount, 2);
  });

  it("1 grace day does NOT absorb a 2-day gap", () => {
    const keys = ["2025-03-10", "2025-03-13"]; // 2-day gap
    const r = recalculateStreak(keys, DAILY, "2025-03-13", 1);
    assert.equal(r.streakCount, 1); // streak resets
  });

  it("2 grace days absorb a 2-day gap", () => {
    const keys = ["2025-03-10", "2025-03-13"]; // 2-day gap
    const r = recalculateStreak(keys, DAILY, "2025-03-13", 2);
    assert.equal(r.streakCount, 2);
  });

  it("grace resets after a real completion (fresh grace for next gap)", () => {
    // Gap of 1, then completed, then another gap of 1 — both covered by grace=1
    const keys = ["2025-03-10", "2025-03-12", "2025-03-14"]; // gaps on 11 and 13
    const r = recalculateStreak(keys, DAILY, "2025-03-14", 1);
    assert.equal(r.streakCount, 3); // both gaps absorbed individually
  });

  it("weekly habit with grace: skipped one week is forgiven", () => {
    // W10, skip W11, W12 → with 1 grace week: streak = 2
    const keys = ["2025-03-03", "2025-03-17"]; // W10 and W12
    const r = recalculateStreak(keys, WEEKLY, "2025-03-17", 1);
    assert.equal(r.streakCount, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Backdated completions
// ─────────────────────────────────────────────────────────────────────────────

describe("recalculateStreak — backdated completions", () => {
  it("adding a backdated completion fills a gap and extends the streak", () => {
    // Existing: Mar 10, Mar 12. Missing: Mar 11.
    // Add Mar 11 retroactively → full run of 3
    const keys = ["2025-03-10", "2025-03-11", "2025-03-12"];
    const r = recalculateStreak(keys, DAILY, "2025-03-12");
    assert.equal(r.streakCount, 3);
  });

  it("backdated completion before a gap does NOT fix a later break", () => {
    // Existing: Mar 08, Mar 10, Mar 12. Backdate Mar 09.
    // Runs: 08-09-10 (3), gap on 11, 12 (1)
    const keys = ["2025-03-08", "2025-03-09", "2025-03-10", "2025-03-12"];
    const r = recalculateStreak(keys, DAILY, "2025-03-12");
    assert.equal(r.streakCount, 1);   // current: just Mar 12
    assert.equal(r.longestStreak, 3); // best: Mar 08-10
  });

  it("backdate far in the past does not affect current run", () => {
    // Long run of recent days, then add completion 30 days ago
    const recent = daysFrom("2025-03-10", [-4, -3, -2, -1, 0]);
    const withBackdate = ["2025-02-01", ...recent];
    const r = recalculateStreak(withBackdate, DAILY, "2025-03-10");
    assert.equal(r.streakCount, 5); // recent run unaffected
    assert.equal(r.longestStreak, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Timezone edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("recalculateStreak — timezone edge cases", () => {
  it("timezone change causing a skipped dateKey does not corrupt oldest streaks", () => {
    // User moved from UTC+9 to UTC-5 on Mar 10. Their local date jumped from
    // "2025-03-10" back to "2025-03-09" effectively — creating no Mar 10 entry.
    // The engine sees a gap of 1 day between Mar 09 and Mar 11.
    const keys = ["2025-03-08", "2025-03-09", "2025-03-11", "2025-03-12"];
    const r = recalculateStreak(keys, DAILY, "2025-03-12");
    // Gap on Mar 10 → streak before: 2, streak after: 2
    assert.equal(r.streakCount, 2);
    assert.equal(r.longestStreak, 2);
  });

  it("two completions on 'same UTC day but different local days' are two separate periods", () => {
    // UTC-5 user completes at 23:00 on Mar 10 (= 04:00 Mar 11 UTC)
    // and UTC+9 user completes at 00:30 on Mar 11 (= 15:30 Mar 10 UTC)
    // The engine only sees the dateKeys sent by each client — no UTC involved.
    const keys = ["2025-03-10", "2025-03-11"];
    const r = recalculateStreak(keys, DAILY, "2025-03-11");
    assert.equal(r.streakCount, 2); // correctly: 2 separate days
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeStreakAfterAdd
// ─────────────────────────────────────────────────────────────────────────────

describe("computeStreakAfterAdd", () => {
  const current = { streakCount: 5, longestStreak: 8, lastCompletedAt: "2025-03-09" };

  it("fast path: adds completion for today → streakCount + 1", () => {
    const allKeys = daysFrom("2025-03-10", [-4, -3, -2, -1, 0]);
    const r = computeStreakAfterAdd(current, "2025-03-10", "2025-03-10", DAILY, allKeys);
    assert.equal(r.streakCount, 6);
    assert.equal(r.longestStreak, 8); // did not beat the record
    assert.equal(r.lastCompletedAt, "2025-03-10");
  });

  it("fast path: new streak beats longestStreak → longestStreak updates", () => {
    const highCurrent = { streakCount: 8, longestStreak: 8, lastCompletedAt: "2025-03-09" };
    const allKeys = daysFrom("2025-03-10", [-7, -6, -5, -4, -3, -2, -1, 0]);
    const r = computeStreakAfterAdd(highCurrent, "2025-03-10", "2025-03-10", DAILY, allKeys);
    assert.equal(r.streakCount, 9);
    assert.equal(r.longestStreak, 9);
  });

  it("backdated completion triggers full recalculation", () => {
    // Add Mar 07 (before lastCompletedAt = Mar 09), filling a gap
    const allKeys = ["2025-03-05", "2025-03-06", "2025-03-07", "2025-03-09"];
    const r = computeStreakAfterAdd(
      { streakCount: 1, longestStreak: 2, lastCompletedAt: "2025-03-09" },
      "2025-03-07",
      "2025-03-09",
      DAILY,
      allKeys,
    );
    // Full recalc: Mar 05-07 (3), gap Mar 08, Mar 09 (1) → current = 1
    assert.equal(r.streakCount, 1);
    assert.equal(r.longestStreak, 3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeStreakAfterRemove
// ─────────────────────────────────────────────────────────────────────────────

describe("computeStreakAfterRemove", () => {
  it("removing today's completion drops streak by 1", () => {
    const remaining = ["2025-03-08", "2025-03-09"]; // removed Mar 10
    const r = computeStreakAfterRemove(remaining, DAILY, "2025-03-10");
    assert.equal(r.streakCount, 2); // Mar 09 = yesterday → still active
  });

  it("removing a middle completion splits the run", () => {
    // Was: Mar 10-11-12 (streak 3). Remove Mar 11.
    const remaining = ["2025-03-10", "2025-03-12"];
    const r = computeStreakAfterRemove(remaining, DAILY, "2025-03-12");
    assert.equal(r.streakCount, 1);   // just Mar 12
    assert.equal(r.longestStreak, 1);
  });

  it("removing the only completion gives streak 0", () => {
    const r = computeStreakAfterRemove([], DAILY, "2025-03-10");
    assert.deepEqual(r, { streakCount: 0, longestStreak: 0, lastCompletedAt: null });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// checkStreakHealth (cron use)
// ─────────────────────────────────────────────────────────────────────────────

describe("checkStreakHealth", () => {
  it("zero streak → isActive: false, shouldReset: false", () => {
    const r = checkStreakHealth(0, null, "2025-03-10", DAILY);
    assert.deepEqual(r, { isActive: false, shouldReset: false });
  });

  it("completed yesterday → isActive: true, shouldReset: false", () => {
    const r = checkStreakHealth(5, "2025-03-09", "2025-03-10", DAILY);
    assert.deepEqual(r, { isActive: true, shouldReset: false });
  });

  it("completed today → isActive: true, shouldReset: false", () => {
    const r = checkStreakHealth(5, "2025-03-10", "2025-03-10", DAILY);
    assert.deepEqual(r, { isActive: true, shouldReset: false });
  });

  it("last completion 2 days ago, no grace → shouldReset: true", () => {
    const r = checkStreakHealth(5, "2025-03-08", "2025-03-10", DAILY, 0);
    assert.deepEqual(r, { isActive: false, shouldReset: true });
  });

  it("last completion 2 days ago, 1 grace day → still active", () => {
    const r = checkStreakHealth(5, "2025-03-08", "2025-03-10", DAILY, 1);
    assert.deepEqual(r, { isActive: true, shouldReset: false });
  });

  it("last completion 2 days ago, only 1 grace day → shouldReset when gap = 2", () => {
    // Gap = 2 days; grace = 1 day. Gap > grace → reset.
    const r = checkStreakHealth(5, "2025-03-07", "2025-03-10", DAILY, 1);
    assert.deepEqual(r, { isActive: false, shouldReset: true });
  });

  it("weekly habit: last week completed, this week not yet → still active", () => {
    // Today = Wed Mar 12 (W11). Last completed = Mar 03 (W10).
    const r = checkStreakHealth(3, "2025-03-03", "2025-03-12", WEEKLY);
    assert.deepEqual(r, { isActive: true, shouldReset: false });
  });

  it("weekly habit: 2 weeks ago completed, no grace → shouldReset", () => {
    // Today = Mar 17 (W12). Last = Mar 03 (W10). Missed W11.
    const r = checkStreakHealth(3, "2025-03-03", "2025-03-17", WEEKLY, 0);
    assert.deepEqual(r, { isActive: false, shouldReset: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Partial weekly habits (edge case)
// ─────────────────────────────────────────────────────────────────────────────

describe("partial weekly habits (targetDays specified)", () => {
  it("weekly habit targeting only Monday: Mon completions count, others ignored", () => {
    const MONDAYS_ONLY = { frequency: "weekly", targetDays: [1], targetCount: 1 };
    // Mon Mar 10, Tue Mar 11 (off-day), Mon Mar 17
    const keys = ["2025-03-10", "2025-03-11", "2025-03-17"];
    const periods = getSatisfiedPeriods(keys, MONDAYS_ONLY);
    // Both Mondays are in different weeks → 2 satisfied weeks
    assert.deepEqual(periods, ["2025-W11", "2025-W12"]);
  });

  it("partial week at start (mid-week join): only the target days that passed are expected", () => {
    // User joins on Thursday Mar 13 (W11). Target = Mon/Wed/Fri.
    // Mon Mar 10 and Wed Mar 12 have already passed. They can still complete Fri Mar 14.
    const keys = ["2025-03-14"]; // Only Fri
    // Mon (Mar 10) and Wed (Mar 12) were before the user joined but are still
    // "missed" from the engine's perspective. streak = 1 period (just Fri).
    const r = recalculateStreak(keys, MON_WED_FRI, "2025-03-14");
    assert.equal(r.streakCount, 1);
  });

  it("weekends-only habit: Sat/Sun completions form a daily streak within their days", () => {
    // 2025-03-08 = Sat, 2025-03-09 = Sun, 2025-03-15 = Sat, 2025-03-16 = Sun
    const keys = ["2025-03-08", "2025-03-09", "2025-03-15", "2025-03-16"];
    const r = recalculateStreak(keys, WEEKENDS, "2025-03-16");
    // Sat→Sun adjacent (gap=1 day, Sun is next target day = adjacent)
    // Sun Mar 09 → Sat Mar 15: 6 days apart, but Sat is the next occurrence of a weekend day
    // With custom frequency: periodsAreAdjacent always returns true for sequential target-day hits
    assert.equal(r.streakCount, 4);
    assert.equal(r.longestStreak, 4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hasUncompletedTargetDayBetween
// ─────────────────────────────────────────────────────────────────────────────

describe("hasUncompletedTargetDayBetween", () => {
  it("no target days between two adjacent dates → false", () => {
    // Mon Mar 10 → Tue Mar 11: no Mon/Wed/Fri between them
    assert.ok(!hasUncompletedTargetDayBetween("2025-03-10", "2025-03-11", [1, 3, 5]));
  });

  it("a target day exists between the two dates → true", () => {
    // Mon Mar 10 → Thu Mar 13: Wed Mar 12 (target day) is between them
    assert.ok(hasUncompletedTargetDayBetween("2025-03-10", "2025-03-13", [1, 3, 5]));
  });

  it("same day → no days between → false", () => {
    assert.ok(!hasUncompletedTargetDayBetween("2025-03-10", "2025-03-10", [1, 3, 5]));
  });

  it("end = start + 1 with no target day between → false", () => {
    // Mon to Tue — Tue is not a target day in [1,3,5] ... wait, 1 = Mon, 2 = Tue
    // We want Tue = 2 not in targetDays [1,3,5]
    assert.ok(!hasUncompletedTargetDayBetween("2025-03-10", "2025-03-11", [1, 3, 5]));
  });
});
