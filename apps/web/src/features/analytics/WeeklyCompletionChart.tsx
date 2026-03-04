import {
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
