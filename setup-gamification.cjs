/**
 * Gamification frontend setup — creates the features/gamification directory
 * and all associated files.
 *
 * Run from the project root:
 *   node setup-gamification.cjs
 */

const fs = require("fs");
const path = require("path");

function write(relPath, content) {
  const abs = path.join(__dirname, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  console.log("✅  " + relPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Redux slice — gamification event queue
// ─────────────────────────────────────────────────────────────────────────────

write("apps/web/src/features/gamification/gamificationSlice.ts", `/**
 * Gamification Slice
 * ──────────────────
 * Stores a queue of GamificationEvents to display as toasts.
 *
 * Events are added by habitsApi.ts after a successful toggle response.
 * The GamificationToast component drains them after display.
 *
 * Max queue size = 5: if the user completes habits very rapidly, older
 * notifications are discarded to prevent a screen-filling stack.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { GamificationEvent } from "../../lib/types";

interface GamificationState {
  events: GamificationEvent[];
}

const initialState: GamificationState = { events: [] };

const MAX_QUEUE = 5;

const gamificationSlice = createSlice({
  name: "gamification",
  initialState,
  reducers: {
    addGamificationEvent(state, action: PayloadAction<GamificationEvent>) {
      state.events = [...state.events, action.payload].slice(-MAX_QUEUE);
    },
    dismissEvent(state, action: PayloadAction<string>) {
      state.events = state.events.filter((e) => e.id !== action.payload);
    },
    clearAllEvents(state) {
      state.events = [];
    },
  },
});

export const { addGamificationEvent, dismissEvent, clearAllEvents } =
  gamificationSlice.actions;

export default gamificationSlice.reducer;
`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. GamificationToast — animated notification stack
// ─────────────────────────────────────────────────────────────────────────────

write("apps/web/src/features/gamification/GamificationToast.tsx", `/**
 * GamificationToast
 * ──────────────────
 * Renders a stack of animated notifications in the bottom-right corner.
 * Each toast auto-dismisses after 4 seconds (reset on hover).
 *
 * One toast per gamification event. Shows:
 *   • XP gained (always)
 *   • Level-up banner (if leveledUp)
 *   • New badge (one per badge, with tier colour)
 *   • Milestone labels (first_completion, streak_7, etc.)
 */
import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { dismissEvent } from "./gamificationSlice";
import type { GamificationEvent } from "../../lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, string> = {
  bronze:   "border-amber-700  bg-amber-950  text-amber-300",
  silver:   "border-slate-500  bg-slate-800  text-slate-200",
  gold:     "border-yellow-500 bg-yellow-950 text-yellow-300",
  platinum: "border-cyan-400   bg-cyan-950   text-cyan-200",
};

const MILESTONE_LABELS: Record<string, string> = {
  first_completion: "🎉 First Completion!",
  completions_7:    "7 Completions!",
  completions_30:   "30 Completions!",
  completions_100:  "💯 100 Completions!",
  completions_365:  "🏆 365 Completions!",
  streak_3:         "3-Day Streak!",
  streak_7:         "🔥 7-Day Streak!",
  streak_14:        "14-Day Streak!",
  streak_30:        "🌙 30-Day Streak!",
  streak_100:       "⚡ 100-Day Streak!",
  streak_365:       "💎 365-Day Streak!",
  level_up:         "Level Up!",
  level_5:          "⬆️ Level 5!",
  level_10:         "🔟 Level 10!",
  level_25:         "👑 Level 25!",
};

// ── Single toast ──────────────────────────────────────────────────────────

function Toast({ event }: { event: GamificationEvent }) {
  const dispatch = useAppDispatch();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = () => {
    timerRef.current = setTimeout(() => dispatch(dismissEvent(event.id)), 4_000);
  };

  useEffect(() => {
    schedule();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const milestoneLabels = event.milestones
    .filter((m) => m !== "level_up") // level-up handled separately
    .map((m) => MILESTONE_LABELS[m])
    .filter(Boolean);

  return (
    <div
      className={[
        "pointer-events-auto w-72 overflow-hidden rounded-xl border bg-slate-900 shadow-2xl shadow-slate-950/80",
        "animate-in slide-in-from-right-4 fade-in duration-300",
      ].join(" ")}
      onMouseEnter={() => {
        if (timerRef.current) clearTimeout(timerRef.current);
      }}
      onMouseLeave={schedule}
      role="alert"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm" aria-hidden="true">✅</span>
          <span className="max-w-[160px] truncate text-xs font-semibold text-slate-200">
            {event.habitTitle}
          </span>
        </div>
        <button
          type="button"
          onClick={() => dispatch(dismissEvent(event.id))}
          className="rounded p-0.5 text-slate-600 transition-colors hover:text-slate-300"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      <div className="space-y-1.5 px-3 py-2.5">
        {/* XP gained */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm" aria-hidden="true">⚡</span>
          <span className="text-sm font-bold text-amber-400">+{event.xpGained} XP</span>
          <span className="ml-auto text-xs text-slate-500">Total: {event.newXp}</span>
        </div>

        {/* Level up */}
        {event.leveledUp && (
          <div className="flex items-center gap-1.5 rounded-lg border border-blue-700 bg-blue-950/50 px-2.5 py-1.5">
            <span className="text-sm" aria-hidden="true">🎊</span>
            <span className="text-xs font-bold text-blue-300">
              Level Up! {event.previousLevel} → {event.newLevel}
            </span>
          </div>
        )}

        {/* New badges */}
        {event.newBadges.map((badge) => (
          <div
            key={badge._id}
            className={\`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 \${
              TIER_STYLES[badge.tier] ?? TIER_STYLES.bronze
            }\`}
          >
            <span className="text-sm shrink-0" aria-hidden="true">{badge.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-tight">{badge.name}</p>
              <p className="text-[10px] opacity-70 truncate">
                {badge.unlockMessage ?? badge.description}
              </p>
            </div>
            <span className="ml-auto shrink-0 text-[10px] font-bold">+{badge.xpReward}</span>
          </div>
        ))}

        {/* Milestone pills */}
        {milestoneLabels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {milestoneLabels.map((label) => (
              <span
                key={label}
                className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Toast stack ───────────────────────────────────────────────────────────

export function GamificationToast() {
  const events = useAppSelector((s) => s.gamification.events);
  if (events.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      aria-label="Notifications"
    >
      {events.map((event) => (
        <Toast key={event.id} event={event} />
      ))}
    </div>
  );
}
`);

// ─────────────────────────────────────────────────────────────────────────────
// 3. LevelProgress — level + XP progress bar (for header / profile)
// ─────────────────────────────────────────────────────────────────────────────

write("apps/web/src/features/gamification/LevelProgress.tsx", `/**
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
`);

// ─────────────────────────────────────────────────────────────────────────────
// 4. BadgeGrid — display earned and locked badges
// ─────────────────────────────────────────────────────────────────────────────

write("apps/web/src/features/gamification/BadgeGrid.tsx", `/**
 * BadgeGrid
 * ─────────
 * Shows all badges in the catalog. Earned badges are coloured by tier.
 * Unearned badges are greyed out with a lock icon.
 *
 * Data comes from two RTK Query calls:
 *   • /analytics/badges (earned list from user profile) → useGetBadgesQuery
 *   • Badge catalog is derived from the earned list + any static metadata
 *
 * For now we render only earned badges (as the catalog is seeded server-side).
 * Unearned badges require a GET /badges catalog endpoint which is noted as a
 * future enhancement.
 */
import React from "react";
import type { BadgeEarned } from "../../lib/types";

const TIER_RING: Record<string, string> = {
  bronze:   "ring-amber-700/60  bg-amber-950/40",
  silver:   "ring-slate-500/60  bg-slate-800/60",
  gold:     "ring-yellow-500/60 bg-yellow-950/40",
  platinum: "ring-cyan-400/60   bg-cyan-950/40",
};

const TIER_LABEL: Record<string, string> = {
  bronze:   "text-amber-400",
  silver:   "text-slate-400",
  gold:     "text-yellow-400",
  platinum: "text-cyan-400",
};

interface BadgeCardProps {
  badge: BadgeEarned;
  earnedAt?: string;
}

function BadgeCard({ badge, earnedAt }: BadgeCardProps) {
  const ringClass = TIER_RING[badge.tier] ?? TIER_RING.bronze;
  const labelClass = TIER_LABEL[badge.tier] ?? TIER_LABEL.bronze;

  return (
    <div
      title={badge.unlockMessage ?? badge.description}
      className={\`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-transform hover:scale-105 ring-1 \${ringClass}\`}
    >
      <span className="text-3xl leading-none" aria-hidden="true">{badge.icon}</span>
      <p className="text-xs font-semibold text-slate-200 leading-tight">{badge.name}</p>
      <p className={\`text-[10px] font-medium capitalize \${labelClass}\`}>{badge.tier}</p>
      {earnedAt && (
        <p className="text-[9px] text-slate-600">
          {new Date(earnedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </p>
      )}
    </div>
  );
}

interface BadgeGridProps {
  badges: (BadgeEarned & { earnedAt?: string })[];
  isLoading?: boolean;
}

export const BadgeGrid = React.memo(function BadgeGrid({
  badges,
  isLoading = false,
}: BadgeGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
        ))}
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-800 py-10 text-center">
        <span className="text-3xl" aria-hidden="true">🏅</span>
        <p className="text-sm text-slate-500">Complete habits to earn badges!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {badges.map((badge) => (
        <BadgeCard key={badge._id} badge={badge} earnedAt={badge.earnedAt} />
      ))}
    </div>
  );
});
`);

console.log("\n🎉  Gamification frontend files written successfully!");
console.log("\nRemaining manual steps:");
console.log("  1. Add gamificationSlice to store.ts (see instructions below)");
console.log("  2. Add <GamificationToast /> to HabitList.tsx");
console.log("  3. npm install (no new deps needed — all Tailwind)");
