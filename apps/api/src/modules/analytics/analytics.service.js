/**
 * Analytics Service — MongoDB aggregation pipelines.
 *
 * All HabitLog pipelines hit indexed paths (no COLLSCAN).
 * Habit collection pipelines use denormalized counters to avoid
 * joining back to HabitLog for every analytics read.
 */
import mongoose from "mongoose";
import { HabitLog } from "../habit-logs/habit-log.model.js";
import { Habit } from "../habits/habit.model.js";

// Returns "YYYY-MM-DD" for UTC date daysAgo days before today
function utcDateKey(daysAgo = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// Fill every day in [startKey, endKey] with default values, merging real data
function fillDailyRange(startKey, endKey, rows) {
  const byKey = new Map(rows.map((r) => [r.dateKey, r]));
  const result = [];
  const cursor = new Date(startKey + "T00:00:00Z");
  const end = new Date(endKey + "T00:00:00Z");
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    result.push({ dateKey: key, count: 0, xpEarned: 0, ...(byKey.get(key) ?? {}) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

// ISO week label "YYYY-WNN"
function isoWeekLabel(dateKey) {
  const d = new Date(dateKey + "T00:00:00Z");
  const startOfYear = new Date(d.getUTCFullYear() + "-01-01T00:00:00Z");
  const dayOfYear = Math.floor((d - startOfYear) / 86_400_000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return d.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

// ── 1. Weekly completion ─────────────────────────────────────────────────────
export async function getWeeklyCompletion(userId) {
  const startKey = utcDateKey(6);
  const todayKey = utcDateKey(0);
  const uid = new mongoose.Types.ObjectId(userId);

  const rows = await HabitLog.aggregate([
    { $match: { userId: uid, dateKey: { $gte: startKey, $lte: todayKey }, skipped: false } },
    { $group: { _id: "$dateKey", count: { $sum: 1 }, xpEarned: { $sum: "$xpEarned" } } },
    { $project: { _id: 0, dateKey: "$_id", count: 1, xpEarned: 1 } },
  ]);

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return fillDailyRange(startKey, todayKey, rows).map((d) => ({
    ...d,
    label: DAY_NAMES[new Date(d.dateKey + "T00:00:00Z").getUTCDay()],
  }));
}

// ── 2. Monthly trend — bucketed by ISO week ──────────────────────────────────
export async function getMonthlyTrend(userId, days = 90) {
  const startKey = utcDateKey(days - 1);
  const todayKey = utcDateKey(0);
  const uid = new mongoose.Types.ObjectId(userId);

  const rows = await HabitLog.aggregate([
    { $match: { userId: uid, dateKey: { $gte: startKey, $lte: todayKey }, skipped: false } },
    { $group: { _id: "$dateKey", count: { $sum: 1 }, xpEarned: { $sum: "$xpEarned" } } },
    { $project: { _id: 0, dateKey: "$_id", count: 1, xpEarned: 1 } },
    { $sort: { dateKey: 1 } },
  ]);

  const daily = fillDailyRange(startKey, todayKey, rows);
  const weekMap = new Map();

  for (const day of daily) {
    const week = isoWeekLabel(day.dateKey);
    if (!weekMap.has(week)) weekMap.set(week, { week, count: 0, xpEarned: 0, days: 0 });
    const e = weekMap.get(week);
    e.count += day.count;
    e.xpEarned += day.xpEarned;
    e.days += 1;
  }

  return Array.from(weekMap.values()).map((w) => ({
    week: w.week,
    count: w.count,
    xpEarned: w.xpEarned,
    avgPerDay: +(w.count / w.days).toFixed(1),
  }));
}

// ── 3. Heatmap — last 365 days ───────────────────────────────────────────────
export async function getHeatmap(userId) {
  const startKey = utcDateKey(364);
  const todayKey = utcDateKey(0);
  const uid = new mongoose.Types.ObjectId(userId);

  const rows = await HabitLog.aggregate([
    { $match: { userId: uid, dateKey: { $gte: startKey, $lte: todayKey }, skipped: false } },
    { $group: { _id: "$dateKey", count: { $sum: 1 } } },
    { $project: { _id: 0, dateKey: "$_id", count: 1 } },
    { $sort: { dateKey: 1 } },
  ]);

  const byKey = new Map(rows.map((r) => [r.dateKey, r.count]));
  const result = [];
  const cursor = new Date(startKey + "T00:00:00Z");
  const end = new Date(todayKey + "T00:00:00Z");

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    result.push({ dateKey: key, count: byKey.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

// ── 4. Streak leaderboard — top 10 by current streak ────────────────────────
export async function getStreakLeaderboard(userId) {
  return Habit.find(
    { userId, archived: false },
    { title: 1, streakCount: 1, longestStreak: 1, category: 1, color: 1 },
  )
    .sort({ streakCount: -1 })
    .limit(10)
    .lean();
}

// ── 5. Category distribution ─────────────────────────────────────────────────
export async function getCategoryDistribution(userId) {
  return Habit.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), archived: false } },
    {
      $group: {
        _id: "$category",
        habitCount: { $sum: 1 },
        totalCompletions: { $sum: "$totalCompletions" },
        avgStreak: { $avg: "$streakCount" },
        avgCompletionRate: { $avg: "$completionRate" },
      },
    },
    {
      $project: {
        _id: 0,
        category: "$_id",
        habitCount: 1,
        totalCompletions: 1,
        avgStreak: { $round: ["$avgStreak", 1] },
        avgCompletionRate: { $round: ["$avgCompletionRate", 3] },
      },
    },
    { $sort: { habitCount: -1 } },
  ]);
}

// ── 6. Summary stats (from denormalized Habit counters) ──────────────────────
export async function getSummaryStats(userId) {
  const [result] = await Habit.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), archived: false } },
    {
      $group: {
        _id: null,
        totalHabits: { $sum: 1 },
        totalCompletions: { $sum: "$totalCompletions" },
        longestStreak: { $max: "$longestStreak" },
        avgCompletionRate: { $avg: "$completionRate" },
        totalXp: { $sum: { $multiply: ["$totalCompletions", "$xpValue"] } },
      },
    },
    {
      $project: {
        _id: 0,
        totalHabits: 1,
        totalCompletions: 1,
        longestStreak: 1,
        avgCompletionRate: { $round: ["$avgCompletionRate", 3] },
        totalXp: 1,
      },
    },
  ]);
  return result ?? {
    totalHabits: 0,
    totalCompletions: 0,
    longestStreak: 0,
    avgCompletionRate: 0,
    totalXp: 0,
  };
}
