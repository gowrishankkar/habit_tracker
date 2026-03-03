import React from "react";
import type { HabitDifficulty } from "../../lib/types";

interface XpBadgeProps {
  xpValue: number;
  difficulty?: HabitDifficulty;
  /** Show "+XP" prefix for earned-today indication */
  earnedToday?: boolean;
  size?: "sm" | "md";
}

const difficultyColors: Record<HabitDifficulty, string> = {
  easy:   "text-green-400",
  medium: "text-blue-400",
  hard:   "text-purple-400",
  expert: "text-amber-400",
};

export const XpBadge = React.memo(function XpBadge({
  xpValue,
  difficulty,
  earnedToday = false,
  size = "sm",
}: XpBadgeProps) {
  const xpColor = difficulty
    ? difficultyColors[difficulty]
    : earnedToday
      ? "text-green-400"
      : "text-slate-500";

  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div
      className={`flex items-center gap-0.5 font-medium tabular-nums ${textSize} ${xpColor}`}
      title={`${xpValue} XP per completion`}
    >
      <span aria-hidden="true">{earnedToday ? "⚡" : "✦"}</span>
      <span>
        {earnedToday && "+"}
        {xpValue}
        <span className="ml-0.5 font-normal opacity-70">XP</span>
      </span>
    </div>
  );
});
