/**
 * LevelProgress
 * ─────────────
 * Displays the user's current level, XP earned in this level, and a progress
 * bar towards the next level.  Pure presentational — no data fetching.
 *
 * Mirrors the server-side level formula:
 *   level = 1 + floor(√(totalXp / 100))
 *   xpForLevel(n) = n² × 100
 */
import React from "react";
import { ProgressBar } from "../../components/ui/ProgressBar";

interface LevelProgressProps {
  xp: number;
  level: number;
  size?: "sm" | "md";
}

/** Total XP threshold to advance past level n → n² × 100 */
function xpForLevel(n: number) {
  return n * n * 100;
}

/** XP accumulated within the current level and gap size to next level */
function progressInLevel(totalXp: number, level: number) {
  const startXp  = level <= 1 ? 0 : xpForLevel(level - 1);
  const endXp    = xpForLevel(level);
  const needed   = endXp - startXp;
  const earned   = Math.max(0, totalXp - startXp);
  const percent  = Math.round((earned / needed) * 100);
  return { earned, needed, percent, nextLevelXp: endXp };
}

export const LevelProgress = React.memo(function LevelProgress({
  xp,
  level,
  size = "md",
}: LevelProgressProps) {
  const { earned, needed, percent, nextLevelXp } = progressInLevel(xp, level);

  if (size === "sm") {
    return (
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-xs font-bold text-slate-300">
          Lvl {level}
        </span>
        <div className="flex-1 min-w-0">
          <ProgressBar value={percent} size="sm" label={"XP progress to level " + (level + 1)} />
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
          {xp} / {nextLevelXp}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-100">Level {level}</span>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
            {xp} XP
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {earned} / {needed} to Level {level + 1}
        </span>
      </div>
      <ProgressBar value={percent} size="md" label={"XP progress to level " + (level + 1)} />
    </div>
  );
});
