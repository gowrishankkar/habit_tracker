import React from "react";
import { ProgressBar } from "../../components/ui/ProgressBar";
import type { DashboardStats } from "./habitSelectors";

interface DashboardStatsProps {
  stats: DashboardStats;
  isLoading?: boolean;
}

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  colorClass?: string;
}

function StatCard({ icon, label, value, sub, colorClass = "text-slate-100" }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4">
      <div className="flex items-center gap-1.5">
        <span className="text-base" aria-hidden="true">{icon}</span>
        <span className="text-xs text-slate-500 truncate">{label}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums leading-none ${colorClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600">{sub}</p>}
    </div>
  );
}

export const DashboardStats = React.memo(function DashboardStats({
  stats,
  isLoading = false,
}: DashboardStatsProps) {
  const completionPct =
    stats.totalActive > 0
      ? Math.round((stats.completedToday / stats.totalActive) * 100)
      : 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-slate-800 bg-slate-900"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon="📋"
          label="Active habits"
          value={stats.totalActive}
          colorClass="text-slate-100"
        />
        <StatCard
          icon="✅"
          label="Done today"
          value={`${stats.completedToday} / ${stats.totalActive}`}
          colorClass={
            completionPct === 100
              ? "text-green-400"
              : completionPct >= 50
                ? "text-blue-400"
                : "text-slate-100"
          }
        />
        <StatCard
          icon="⚡"
          label="XP today"
          value={`+${stats.totalXpToday}`}
          colorClass="text-amber-400"
          sub="points earned"
        />
        <StatCard
          icon="🔥"
          label="Best streak"
          value={stats.longestCurrentStreak}
          colorClass="text-orange-400"
          sub={`avg ${stats.avgStreakCount} days`}
        />
      </div>

      {/* Today's progress */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-300">Today&apos;s progress</span>
          <span className="tabular-nums text-slate-500">
            {stats.completedToday}/{stats.totalActive} habits
          </span>
        </div>
        <ProgressBar value={completionPct} label="Today's completion" size="md" />
        {completionPct === 100 && stats.totalActive > 0 && (
          <p className="mt-1.5 text-center text-xs font-medium text-green-400">
            🎉 All habits completed today!
          </p>
        )}
      </div>
    </div>
  );
});
