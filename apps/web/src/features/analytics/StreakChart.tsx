import {
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
