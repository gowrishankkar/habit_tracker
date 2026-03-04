/**
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
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
              TIER_STYLES[badge.tier] ?? TIER_STYLES.bronze
            }`}
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
