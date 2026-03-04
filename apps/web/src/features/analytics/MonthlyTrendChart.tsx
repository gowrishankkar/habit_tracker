import { useState } from "react";
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
