/**
 * Creates the analytics module directory and files.
 * Run: node create-analytics-module.cjs
 */
"use strict";
const fs = require("fs");
const path = require("path");

const API_DIR = path.join(
  __dirname,
  "apps/api/src/modules/analytics"
);
const WEB_DIR = path.join(
  __dirname,
  "apps/web/src/features/analytics"
);

fs.mkdirSync(API_DIR, { recursive: true });
fs.mkdirSync(WEB_DIR, { recursive: true });

// ── analytics.routes.js ───────────────────────────────────────────────────────
fs.writeFileSync(path.join(API_DIR, "analytics.routes.js"), `import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as analyticsController from "./analytics.controller.js";

const router = Router();
router.use(authenticate);

router.get("/summary", analyticsController.summary);
router.get("/weekly", analyticsController.weekly);
router.get("/monthly", analyticsController.monthly);
router.get("/heatmap", analyticsController.heatmap);
router.get("/streaks", analyticsController.streaks);
router.get("/categories", analyticsController.categories);

export default router;
`);

// ── analytics.service.js ──────────────────────────────────────────────────────
fs.writeFileSync(path.join(API_DIR, "analytics.service.js"), `import mongoose from "mongoose";
import { HabitLog } from "../habit-logs/habit-log.model.js";
import { Habit } from "../habits/habit.model.js";

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateKey(d);
}

export async function getSummary(userId) {
  const uid = toObjectId(userId);
  const [habits, logStats] = await Promise.all([
    Habit.find({ userId: uid, archived: false }).select("streakCount longestStreak"),
    HabitLog.aggregate([
      { $match: { userId: uid } },
      { $group: { _id: null, totalCompletions: { $sum: 1 }, totalXp: { $sum: "$xpEarned" } } },
    ]),
  ]);
  const stats = logStats[0] ?? { totalCompletions: 0, totalXp: 0 };
  return {
    totalHabits: habits.length,
    totalCompletions: stats.totalCompletions,
    totalXp: stats.totalXp,
    currentStreakSum: habits.reduce((s, h) => s + (h.streakCount || 0), 0),
    longestStreak: habits.reduce((max, h) => Math.max(max, h.longestStreak || 0), 0),
  };
}

export async function getWeekly(userId, anchorDate) {
  const uid = toObjectId(userId);
  const end = anchorDate || dateKey(new Date());
  const endD = new Date(end + "T00:00:00Z");
  const startD = new Date(endD);
  startD.setDate(startD.getDate() - 6);
  const start = dateKey(startD);

  const rows = await HabitLog.aggregate([
    { $match: { userId: uid, dateKey: { $gte: start, $lte: end }, skipped: false } },
    { $group: { _id: "$dateKey", count: { $sum: 1 }, xp: { $sum: "$xpEarned" } } },
    { $sort: { _id: 1 } },
  ]);

  const map = Object.fromEntries(rows.map((r) => [r._id, r]));
  const result = [];
  const cursor = new Date(startD);
  while (dateKey(cursor) <= end) {
    const key = dateKey(cursor);
    result.push({ date: key, count: map[key]?.count ?? 0, xp: map[key]?.xp ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export async function getMonthly(userId, year, month) {
  const uid = toObjectId(userId);
  const y = parseInt(year, 10) || new Date().getFullYear();
  const m = parseInt(month, 10) || new Date().getMonth() + 1;
  const start = \`\${y}-\${String(m).padStart(2, "0")}-01\`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = \`\${y}-\${String(m).padStart(2, "0")}-\${String(lastDay).padStart(2, "0")}\`;

  const rows = await HabitLog.aggregate([
    { $match: { userId: uid, dateKey: { $gte: start, $lte: end }, skipped: false } },
    { $group: { _id: "$dateKey", count: { $sum: 1 }, xp: { $sum: "$xpEarned" } } },
    { $sort: { _id: 1 } },
  ]);

  const map = Object.fromEntries(rows.map((r) => [r._id, r]));
  const result = [];
  for (let d = 1; d <= lastDay; d++) {
    const key = \`\${y}-\${String(m).padStart(2, "0")}-\${String(d).padStart(2, "0")}\`;
    result.push({ date: key, count: map[key]?.count ?? 0, xp: map[key]?.xp ?? 0 });
  }
  return result;
}

export async function getHeatmap(userId, months = 12) {
  const uid = toObjectId(userId);
  const start = daysAgo(months * 30);
  return HabitLog.aggregate([
    { $match: { userId: uid, dateKey: { $gte: start }, skipped: false } },
    { $group: { _id: "$dateKey", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", count: 1 } },
  ]);
}

export async function getStreaks(userId) {
  const uid = toObjectId(userId);
  const habits = await Habit.find({ userId: uid, archived: false }).select(
    "title category streakCount longestStreak"
  );
  return habits.map((h) => ({
    habitId: h._id,
    title: h.title,
    category: h.category,
    streakCount: h.streakCount,
    longestStreak: h.longestStreak,
  }));
}

export async function getCategories(userId) {
  const uid = toObjectId(userId);
  const start = daysAgo(30);
  return HabitLog.aggregate([
    { $match: { userId: uid, dateKey: { $gte: start }, skipped: false } },
    { $lookup: { from: "habits", localField: "habitId", foreignField: "_id", as: "habit" } },
    { $unwind: "$habit" },
    { $group: { _id: "$habit.category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { _id: 0, category: "$_id", count: 1 } },
  ]);
}
`);

// ── analytics.controller.js ───────────────────────────────────────────────────
fs.writeFileSync(path.join(API_DIR, "analytics.controller.js"), `import { sendSuccess } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as analyticsService from "./analytics.service.js";

export const summary = asyncHandler(async (req, res) => {
  sendSuccess(res, await analyticsService.getSummary(req.userId));
});
export const weekly = asyncHandler(async (req, res) => {
  sendSuccess(res, await analyticsService.getWeekly(req.userId, req.query.date));
});
export const monthly = asyncHandler(async (req, res) => {
  sendSuccess(res, await analyticsService.getMonthly(req.userId, req.query.year, req.query.month));
});
export const heatmap = asyncHandler(async (req, res) => {
  sendSuccess(res, await analyticsService.getHeatmap(req.userId, parseInt(req.query.months, 10) || 12));
});
export const streaks = asyncHandler(async (req, res) => {
  sendSuccess(res, await analyticsService.getStreaks(req.userId));
});
export const categories = asyncHandler(async (req, res) => {
  sendSuccess(res, await analyticsService.getCategories(req.userId));
});
`);

// ── Frontend: analyticsApi.js ─────────────────────────────────────────────────
fs.writeFileSync(path.join(WEB_DIR, "analyticsApi.js"), `import { apiSlice } from "../auth/authApi";

export const analyticsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSummary: builder.query({
      query: () => "/analytics/summary",
      transformResponse: (res) => res.data,
      providesTags: ["Analytics"],
    }),
    getWeekly: builder.query({
      query: (date) => \`/analytics/weekly\${date ? \`?date=\${date}\` : ""}\`,
      transformResponse: (res) => res.data,
      providesTags: ["Analytics"],
    }),
    getMonthly: builder.query({
      query: ({ year, month } = {}) => {
        const now = new Date();
        return \`/analytics/monthly?year=\${year ?? now.getFullYear()}&month=\${month ?? now.getMonth() + 1}\`;
      },
      transformResponse: (res) => res.data,
      providesTags: ["Analytics"],
    }),
    getHeatmap: builder.query({
      query: (months = 12) => \`/analytics/heatmap?months=\${months}\`,
      transformResponse: (res) => res.data,
      providesTags: ["Analytics"],
    }),
    getStreaks: builder.query({
      query: () => "/analytics/streaks",
      transformResponse: (res) => res.data,
      providesTags: ["Analytics"],
    }),
    getCategories: builder.query({
      query: () => "/analytics/categories",
      transformResponse: (res) => res.data,
      providesTags: ["Analytics"],
    }),
  }),
});

export const {
  useGetSummaryQuery,
  useGetWeeklyQuery,
  useGetMonthlyQuery,
  useGetHeatmapQuery,
  useGetStreaksQuery,
  useGetCategoriesQuery,
} = analyticsApi;
`);

// ── Frontend: AnalyticsDashboard.jsx ─────────────────────────────────────────
fs.writeFileSync(path.join(WEB_DIR, "AnalyticsDashboard.jsx"), `import {
  useGetSummaryQuery,
  useGetWeeklyQuery,
  useGetMonthlyQuery,
  useGetHeatmapQuery,
  useGetStreaksQuery,
  useGetCategoriesQuery,
} from "./analyticsApi";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4"];

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-white">{value ?? "—"}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children, className = "" }) {
  return (
    <div className={\`rounded-xl bg-slate-800 border border-slate-700 p-5 \${className}\`}>
      <h2 className="mb-4 text-lg font-semibold text-slate-200">{title}</h2>
      {children}
    </div>
  );
}

function LoadingBox() {
  return <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Loading…</div>;
}

function HeatmapCalendar({ data = [] }) {
  const map = Object.fromEntries(data.map((d) => [d.date, d.count]));
  const today = new Date();
  const cells = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = map[key] ?? 0;
    const intensity =
      count === 0 ? "bg-slate-700"
      : count === 1 ? "bg-blue-900"
      : count <= 3 ? "bg-blue-600"
      : "bg-blue-400";
    cells.push(
      <div key={key} title={\`\${key}: \${count} completion\${count !== 1 ? "s" : ""}\`}
        className={\`h-3 w-3 rounded-sm \${intensity}\`} />
    );
  }
  return <div className="flex flex-wrap gap-1">{cells}</div>;
}

export default function AnalyticsDashboard() {
  const { data: summary } = useGetSummaryQuery();
  const { data: weekly } = useGetWeeklyQuery(undefined);
  const { data: monthly } = useGetMonthlyQuery({});
  const { data: heatmap } = useGetHeatmapQuery(12);
  const { data: streaks } = useGetStreaksQuery();
  const { data: categories } = useGetCategoriesQuery();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-white">Analytics</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Habits" value={summary?.totalHabits} />
        <StatCard label="Total Completions" value={summary?.totalCompletions} />
        <StatCard label="Active Streaks" value={summary?.currentStreakSum} sub="sum across all habits" />
        <StatCard label="Longest Streak" value={summary?.longestStreak} sub="days" />
      </div>

      <ChartCard title="This Week — Completions">
        {!weekly ? <LoadingBox /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", color: "#f1f5f9" }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} name="Completions" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="This Month — Daily Trend">
        {!monthly ? <LoadingBox /> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(8)} tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", color: "#f1f5f9" }} />
              <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Completions" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Category Distribution (30 days)">
          {!categories || categories.length === 0 ? <LoadingBox /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={categories} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={80}
                  label={({ category, percent }) => \`\${category} \${(percent * 100).toFixed(0)}%\`} labelLine={false}>
                  {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", color: "#f1f5f9" }} />
                <Legend formatter={(v) => <span style={{ color: "#94a3b8" }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Current Streaks by Habit">
          {!streaks || streaks.length === 0 ? <LoadingBox /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={streaks.slice(0, 8)} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis dataKey="title" type="category" width={100} tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(v) => v.length > 14 ? v.slice(0, 13) + "…" : v} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", color: "#f1f5f9" }} />
                <Bar dataKey="streakCount" fill="#10b981" radius={[0,4,4,0]} name="Streak" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Completion Heatmap — Last 12 Months">
        {!heatmap ? <LoadingBox /> : <HeatmapCalendar data={heatmap} />}
      </ChartCard>
    </div>
  );
}
`);

console.log("✅  Analytics module created:");
console.log("    Backend →", API_DIR);
console.log("    Frontend →", WEB_DIR);
