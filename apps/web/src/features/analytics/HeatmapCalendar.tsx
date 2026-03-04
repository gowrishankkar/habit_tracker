import { useState } from "react";
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
