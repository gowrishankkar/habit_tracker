import React from "react";

interface StreakBadgeProps {
  count: number;
  longest?: number;
  size?: "sm" | "md";
}

/** Milestone thresholds that unlock a special visual. */
function getStreakTier(n: number): { color: string; glow: string } {
  if (n >= 100) return { color: "text-amber-300", glow: "drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" };
  if (n >= 30)  return { color: "text-orange-400", glow: "drop-shadow-[0_0_4px_rgba(251,146,60,0.7)]" };
  if (n >= 7)   return { color: "text-orange-500", glow: "" };
  if (n >= 3)   return { color: "text-slate-300",  glow: "" };
  return              { color: "text-slate-500",  glow: "" };
}

export const StreakBadge = React.memo(function StreakBadge({
  count,
  longest,
  size = "md",
}: StreakBadgeProps) {
  const { color, glow } = getStreakTier(count);
  const isActive = count > 0;

  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const iconSize = size === "sm" ? "text-sm" : "text-base";

  return (
    <div className="flex items-center gap-1" title={longest ? `Longest streak: ${longest}` : undefined}>
      <span
        className={`${iconSize} ${glow} transition-all duration-300`}
        aria-hidden="true"
      >
        {isActive ? "🔥" : "💤"}
      </span>
      <span className={`font-semibold tabular-nums ${textSize} ${color}`}>
        {count}
      </span>
      {size === "md" && (
        <span className="text-xs text-slate-600">
          {count === 1 ? "day" : "days"}
        </span>
      )}
    </div>
  );
});
