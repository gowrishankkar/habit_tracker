/**
 * One-time setup script — creates the analytics module directories and
 * writes all analytics source files.
 *
 * Run from the project root:
 *   node setup-analytics.cjs
 */

const fs = require("fs");
const path = require("path");

function write(relPath, content) {
  const abs = path.join(__dirname, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  console.log("✅  " + relPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND
// ─────────────────────────────────────────────────────────────────────────────

write("apps/api/src/modules/analytics/analytics.service.js", `/**
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
`);

write("apps/api/src/modules/analytics/analytics.controller.js", `import { sendSuccess } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as svc from "./analytics.service.js";

export const summaryStats = asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getSummaryStats(req.userId));
});

export const weeklyCompletion = asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getWeeklyCompletion(req.userId));
});

export const monthlyTrend = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days ?? "90", 10), 7), 365);
  sendSuccess(res, await svc.getMonthlyTrend(req.userId, days));
});

export const heatmap = asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getHeatmap(req.userId));
});

export const streakLeaderboard = asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getStreakLeaderboard(req.userId));
});

export const categoryDistribution = asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getCategoryDistribution(req.userId));
});
`);

write("apps/api/src/modules/analytics/analytics.routes.js", `import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as ctrl from "./analytics.controller.js";

const router = Router();

// All analytics routes require a valid access token
router.use(authenticate);

router.get("/summary",    ctrl.summaryStats);
router.get("/weekly",     ctrl.weeklyCompletion);
router.get("/monthly",    ctrl.monthlyTrend);      // ?days=30|60|90
router.get("/heatmap",    ctrl.heatmap);
router.get("/streaks",    ctrl.streakLeaderboard);
router.get("/categories", ctrl.categoryDistribution);

export default router;
`);

// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND
// ─────────────────────────────────────────────────────────────────────────────

write("apps/web/src/features/analytics/analyticsApi.ts", `import { apiSlice } from "../auth/authApi";
import type {
  AnalyticsSummary,
  WeeklyDataPoint,
  MonthlyDataPoint,
  HeatmapDay,
  StreakEntry,
  CategorySlice,
} from "../../lib/types";

export const analyticsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAnalyticsSummary: builder.query<AnalyticsSummary, void>({
      query: () => "/analytics/summary",
      transformResponse: (res: { data: AnalyticsSummary }) => res.data,
      providesTags: [{ type: "Analytics" as const, id: "SUMMARY" }],
    }),
    getWeeklyCompletion: builder.query<WeeklyDataPoint[], void>({
      query: () => "/analytics/weekly",
      transformResponse: (res: { data: WeeklyDataPoint[] }) => res.data,
      providesTags: [{ type: "Analytics" as const, id: "WEEKLY" }],
    }),
    getMonthlyTrend: builder.query<MonthlyDataPoint[], number>({
      query: (days = 90) => "/analytics/monthly?days=" + days,
      transformResponse: (res: { data: MonthlyDataPoint[] }) => res.data,
      providesTags: (_r, _e, days) => [{ type: "Analytics" as const, id: "MONTHLY_" + days }],
    }),
    getHeatmap: builder.query<HeatmapDay[], void>({
      query: () => "/analytics/heatmap",
      transformResponse: (res: { data: HeatmapDay[] }) => res.data,
      providesTags: [{ type: "Analytics" as const, id: "HEATMAP" }],
    }),
    getStreakLeaderboard: builder.query<StreakEntry[], void>({
      query: () => "/analytics/streaks",
      transformResponse: (res: { data: StreakEntry[] }) => res.data,
      providesTags: [{ type: "Analytics" as const, id: "STREAKS" }],
    }),
    getCategoryDistribution: builder.query<CategorySlice[], void>({
      query: () => "/analytics/categories",
      transformResponse: (res: { data: CategorySlice[] }) => res.data,
      providesTags: [{ type: "Analytics" as const, id: "CATEGORIES" }],
    }),
  }),
});

export const {
  useGetAnalyticsSummaryQuery,
  useGetWeeklyCompletionQuery,
  useGetMonthlyTrendQuery,
  useGetHeatmapQuery,
  useGetStreakLeaderboardQuery,
  useGetCategoryDistributionQuery,
} = analyticsApi;
`);

write("apps/web/src/features/analytics/ChartCard.tsx", `import React from "react";
import { Spinner } from "../../components/ui/Spinner";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  isError?: boolean;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  isLoading = false,
  isError = false,
  children,
  actions,
}: ChartCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="md" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="flex h-48 items-center justify-center text-sm text-red-400">
          Failed to load data
        </div>
      )}

      {!isLoading && !isError && children}
    </div>
  );
}
`);

write("apps/web/src/features/analytics/WeeklyCompletionChart.tsx", `import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useGetWeeklyCompletionQuery } from "./analyticsApi";
import { ChartCard } from "./ChartCard";
import type { WeeklyDataPoint } from "../../lib/types";

function WeeklyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-slate-200">{label}</p>
      <p className="text-blue-400">{payload[0]?.value ?? 0} completions</p>
      <p className="text-amber-400">+{payload[1]?.value ?? 0} XP</p>
    </div>
  );
}

export function WeeklyCompletionChart() {
  const { data = [], isLoading, isError } = useGetWeeklyCompletionQuery();

  // Compute total for subtitle
  const totalThisWeek = data.reduce((s, d) => s + d.count, 0);

  return (
    <ChartCard
      title="This week"
      subtitle={totalThisWeek + " completions in the last 7 days"}
      isLoading={isLoading}
      isError={isError}
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<WeeklyTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
            <Bar dataKey="count" name="Completions" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={40} />
            <Bar dataKey="xpEarned" name="XP" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
`);

write("apps/web/src/features/analytics/MonthlyTrendChart.tsx", `import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useGetMonthlyTrendQuery } from "./analyticsApi";
import { ChartCard } from "./ChartCard";

type Window = 30 | 60 | 90;

const WINDOWS: { value: Window; label: string }[] = [
  { value: 30, label: "30d" },
  { value: 60, label: "60d" },
  { value: 90, label: "90d" },
];

function MonthlyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-slate-200">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export function MonthlyTrendChart() {
  const [days, setDays] = useState<Window>(90);
  const { data = [], isLoading, isError } = useGetMonthlyTrendQuery(days);

  const windowActions = (
    <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          type="button"
          onClick={() => setDays(w.value)}
          className={[
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            days === w.value
              ? "bg-slate-600 text-slate-100"
              : "text-slate-500 hover:text-slate-300",
          ].join(" ")}
        >
          {w.label}
        </button>
      ))}
    </div>
  );

  return (
    <ChartCard
      title="Completion trend"
      subtitle="Weekly habit completions over time"
      isLoading={isLoading}
      isError={isError}
      actions={windowActions}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <defs>
              <linearGradient id="gradCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradXp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<MonthlyTooltip />} cursor={{ stroke: "#334155", strokeWidth: 1 }} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v) => <span style={{ color: "#94a3b8" }}>{v}</span>}
            />
            <Area
              type="monotone"
              dataKey="count"
              name="Completions"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#gradCount)"
              dot={false}
              activeDot={{ r: 4, fill: "#3b82f6" }}
            />
            <Area
              type="monotone"
              dataKey="xpEarned"
              name="XP earned"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#gradXp)"
              dot={false}
              activeDot={{ r: 4, fill: "#f59e0b" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
`);

write("apps/web/src/features/analytics/HeatmapCalendar.tsx", `import { useState } from "react";
import { useGetHeatmapQuery } from "./analyticsApi";
import { ChartCard } from "./ChartCard";
import type { HeatmapDay } from "../../lib/types";

// Colour scale: 0 → slate-800, 1 → blue-950, 2-3 → blue-800, 4-6 → blue-600, 7+ → blue-400
function getHeatColor(count: number): string {
  if (count === 0) return "#1e293b";
  if (count === 1) return "#1e3a5f";
  if (count <= 3) return "#1d4ed8";
  if (count <= 6) return "#3b82f6";
  return "#93c5fd";
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface Tooltip {
  dateKey: string;
  count: number;
  x: number;
  y: number;
}

export function HeatmapCalendar() {
  const { data = [], isLoading, isError } = useGetHeatmapQuery();
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  if (!isLoading && !isError && data.length === 0) return null;

  // Build week columns: group consecutive days into columns of 7,
  // padding the first column to start on Sunday.
  const firstDate = data[0] ? new Date(data[0].dateKey + "T00:00:00Z") : null;
  const dayOffset = firstDate ? firstDate.getUTCDay() : 0;

  // Pad so week columns align to Sunday
  const padded: (HeatmapDay | null)[] = [...Array(dayOffset).fill(null), ...data];
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  // Compute month label positions
  const monthPositions: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstReal = week.find(Boolean);
    if (firstReal) {
      const m = new Date((firstReal as HeatmapDay).dateKey + "T00:00:00Z").getUTCMonth();
      if (m !== lastMonth) {
        monthPositions.push({ label: MONTH_LABELS[m], col: wi });
        lastMonth = m;
      }
    }
  });

  const CELL = 12;
  const GAP = 2;
  const STEP = CELL + GAP;
  const svgW = weeks.length * STEP;
  const svgH = 7 * STEP + 22; // 22px for month labels

  const totalCompletions = data.reduce((s, d) => s + d.count, 0);

  return (
    <ChartCard
      title="Activity heatmap"
      subtitle={totalCompletions + " completions in the last year"}
      isLoading={isLoading}
      isError={isError}
    >
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-3">
          {/* Day-of-week labels */}
          <div className="flex shrink-0 flex-col gap-0 pt-5" style={{ width: 28 }}>
            {DAY_LABELS.map((d, i) => (
              <div
                key={d}
                style={{ height: STEP, lineHeight: STEP + "px" }}
                className="text-right text-[9px] text-slate-600 pr-1"
              >
                {i % 2 === 1 ? d : ""}
              </div>
            ))}
          </div>

          <div className="relative">
            {/* Month labels */}
            <div className="relative" style={{ height: 18 }}>
              {monthPositions.map(({ label, col }) => (
                <span
                  key={label + col}
                  style={{ left: col * STEP, top: 0 }}
                  className="absolute text-[9px] text-slate-500"
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Week columns */}
            <div className="flex gap-0" style={{ gap: GAP }}>
              {weeks.map((week, wi) => (
                <div
                  key={wi}
                  className="flex flex-col"
                  style={{ gap: GAP, width: CELL }}
                >
                  {Array.from({ length: 7 }).map((_, di) => {
                    const day = week[di];
                    return (
                      <div
                        key={di}
                        style={{
                          width: CELL,
                          height: CELL,
                          borderRadius: 2,
                          backgroundColor: day ? getHeatColor(day.count) : "#0f172a",
                          cursor: day ? "pointer" : "default",
                          flexShrink: 0,
                        }}
                        onMouseEnter={
                          day
                            ? (e) => {
                                const rect = (e.target as HTMLElement).getBoundingClientRect();
                                setTooltip({ ...day, x: rect.left, y: rect.top });
                              }
                            : undefined
                        }
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-2 flex items-center gap-1.5 pl-8 text-[9px] text-slate-600">
          <span>Less</span>
          {[0, 1, 3, 5, 7].map((n) => (
            <div
              key={n}
              style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: getHeatColor(n), flexShrink: 0 }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs shadow-xl"
          style={{ left: tooltip.x + 16, top: tooltip.y - 8 }}
        >
          <p className="text-slate-400">{tooltip.dateKey}</p>
          <p className="font-semibold text-slate-100">{tooltip.count} completion{tooltip.count !== 1 ? "s" : ""}</p>
        </div>
      )}
    </ChartCard>
  );
}
`);

write("apps/web/src/features/analytics/StreakChart.tsx", `import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { useGetStreakLeaderboardQuery } from "./analyticsApi";
import { ChartCard } from "./ChartCard";

// Category → colour mapping mirrors the CategoryPieChart palette
const CAT_COLORS: Record<string, string> = {
  health:        "#22c55e",
  fitness:       "#f97316",
  mindfulness:   "#a78bfa",
  learning:      "#38bdf8",
  productivity:  "#facc15",
  social:        "#fb7185",
  finance:       "#34d399",
  creativity:    "#f472b6",
  other:         "#94a3b8",
};

function StreakTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 max-w-[160px] truncate font-semibold text-slate-100">{d.title}</p>
      <p style={{ color: CAT_COLORS[d.category] ?? "#94a3b8" }} className="capitalize">
        {d.category}
      </p>
      <p className="text-orange-400">{d.streakCount} day streak</p>
      <p className="text-slate-500">Best: {d.longestStreak} days</p>
    </div>
  );
}

export function StreakChart() {
  const { data = [], isLoading, isError } = useGetStreakLeaderboardQuery();
  const top8 = data.slice(0, 8);

  // Truncate long habit titles for the Y axis
  const chartData = top8.map((h) => ({
    ...h,
    shortTitle: h.title.length > 18 ? h.title.slice(0, 17) + "…" : h.title,
  }));

  return (
    <ChartCard
      title="Streak leaderboard"
      subtitle="Your top habits ranked by current streak"
      isLoading={isLoading}
      isError={isError}
    >
      {top8.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">
          Complete some habits to see your streaks
        </div>
      ) : (
        <div style={{ height: Math.max(top8.length * 44, 160) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 40, bottom: 0, left: 4 }}
            >
              <XAxis
                type="number"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="shortTitle"
                width={120}
                tick={{ fill: "#cbd5e1", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<StreakTooltip />} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
              <Bar dataKey="streakCount" radius={[0, 4, 4, 0]} maxBarSize={28} label={{ position: "right", fill: "#94a3b8", fontSize: 11 }}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={CAT_COLORS[entry.category] ?? "#3b82f6"}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
`);

write("apps/web/src/features/analytics/CategoryPieChart.tsx", `import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useGetCategoryDistributionQuery } from "./analyticsApi";
import { ChartCard } from "./ChartCard";

const CAT_COLORS: Record<string, string> = {
  health:        "#22c55e",
  fitness:       "#f97316",
  mindfulness:   "#a78bfa",
  learning:      "#38bdf8",
  productivity:  "#facc15",
  social:        "#fb7185",
  finance:       "#34d399",
  creativity:    "#f472b6",
  other:         "#94a3b8",
};

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold capitalize text-slate-100">{d.category}</p>
      <p className="text-slate-400">{d.habitCount} habit{d.habitCount !== 1 ? "s" : ""}</p>
      <p className="text-slate-400">{d.totalCompletions} total completions</p>
      <p className="text-orange-400">Avg streak: {d.avgStreak} days</p>
    </div>
  );
}

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.08) return null; // skip tiny slices
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {Math.round(percent * 100)}%
    </text>
  );
}

export function CategoryPieChart() {
  const { data = [], isLoading, isError } = useGetCategoryDistributionQuery();
  const totalHabits = data.reduce((s, d) => s + d.habitCount, 0);

  return (
    <ChartCard
      title="Category breakdown"
      subtitle={totalHabits + " active habits across " + data.length + " categories"}
      isLoading={isLoading}
      isError={isError}
    >
      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">
          Create habits to see category distribution
        </div>
      ) : (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="48%"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={2}
                dataKey="habitCount"
                nameKey="category"
                labelLine={false}
                label={renderCustomLabel}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.category}
                    fill={CAT_COLORS[entry.category] ?? "#94a3b8"}
                  />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend
                formatter={(value) => (
                  <span style={{ color: "#94a3b8", fontSize: 11, textTransform: "capitalize" }}>
                    {value}
                  </span>
                )}
                iconType="circle"
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
`);

write("apps/web/src/features/analytics/AnalyticsDashboard.tsx", `import { useGetAnalyticsSummaryQuery } from "./analyticsApi";
import { WeeklyCompletionChart } from "./WeeklyCompletionChart";
import { MonthlyTrendChart } from "./MonthlyTrendChart";
import { HeatmapCalendar } from "./HeatmapCalendar";
import { StreakChart } from "./StreakChart";
import { CategoryPieChart } from "./CategoryPieChart";

interface StatPillProps {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
}

function StatPill({ icon, label, value, color = "text-slate-100" }: StatPillProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
      <div className="flex items-center gap-1.5">
        <span className="text-sm" aria-hidden="true">{icon}</span>
        <span className="text-[11px] text-slate-500 truncate">{label}</span>
      </div>
      <p className={"text-xl font-bold tabular-nums " + color}>{value}</p>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetAnalyticsSummaryQuery();

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Your habit performance at a glance</p>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {summaryLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
          ))
        ) : summary ? (
          <>
            <StatPill icon="📋" label="Active habits"   value={summary.totalHabits}                            />
            <StatPill icon="✅" label="All-time done"   value={summary.totalCompletions.toLocaleString()}      />
            <StatPill icon="🔥" label="Longest streak"  value={summary.longestStreak + " days"} color="text-orange-400" />
            <StatPill icon="⚡" label="Total XP"         value={summary.totalXp.toLocaleString()}   color="text-amber-400" />
            <StatPill
              icon="📈"
              label="Avg completion"
              value={Math.round(summary.avgCompletionRate * 100) + "%"}
              color={
                summary.avgCompletionRate >= 0.8
                  ? "text-green-400"
                  : summary.avgCompletionRate >= 0.5
                  ? "text-blue-400"
                  : "text-slate-100"
              }
            />
          </>
        ) : null}
      </div>

      {/* Row 1: Weekly bar + Category pie */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyCompletionChart />
        </div>
        <div>
          <CategoryPieChart />
        </div>
      </div>

      {/* Row 2: Monthly area trend */}
      <MonthlyTrendChart />

      {/* Row 3: Activity heatmap */}
      <HeatmapCalendar />

      {/* Row 4: Streak leaderboard */}
      <StreakChart />
    </div>
  );
}
`);

console.log("\n🎉  All analytics files written successfully!");
console.log("\nNext steps:");
console.log("  1. cd apps/web && npm install recharts @types/recharts");
console.log("  2. npm run dev");
