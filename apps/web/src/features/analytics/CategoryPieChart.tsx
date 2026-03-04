import {
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
