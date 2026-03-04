import { useGetAnalyticsSummaryQuery } from "./analyticsApi";
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
