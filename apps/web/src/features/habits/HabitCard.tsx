/**
 * HabitCard
 * ─────────
 * Memoised with React.memo + a custom comparator so it only re-renders when
 * the specific habit data changes (not on every toggle of a sibling card).
 *
 * Layout (mobile-first, responsive):
 *   ┌─────────────────────────────────────────┐
 *   │  [●] Title          🔥 12  ✦ 10XP  [×] │
 *   │      Description                        │
 *   │  ████████░░░░  Category  Difficulty     │
 *   └─────────────────────────────────────────┘
 */

import React, { useCallback } from "react";
import type { Habit } from "../../lib/types";
import { StreakBadge } from "./StreakBadge";
import { XpBadge } from "./XpBadge";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Spinner } from "../../components/ui/Spinner";
import { isCompletedToday } from "./habitSelectors";

// ─────────────────────────────────────────────────────────────────────────────
// Category pill colours
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  health:        "bg-green-950  text-green-400  border-green-900",
  fitness:       "bg-blue-950   text-blue-400   border-blue-900",
  mindfulness:   "bg-purple-950 text-purple-400 border-purple-900",
  learning:      "bg-amber-950  text-amber-400  border-amber-900",
  productivity:  "bg-cyan-950   text-cyan-400   border-cyan-900",
  social:        "bg-pink-950   text-pink-400   border-pink-900",
  finance:       "bg-lime-950   text-lime-400   border-lime-900",
  creativity:    "bg-orange-950 text-orange-400 border-orange-900",
  other:         "bg-slate-800  text-slate-400  border-slate-700",
};

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  easy:   { label: "Easy",   color: "text-green-500" },
  medium: { label: "Medium", color: "text-blue-500" },
  hard:   { label: "Hard",   color: "text-purple-500" },
  expert: { label: "Expert", color: "text-amber-500" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Frequency label
// ─────────────────────────────────────────────────────────────────────────────

function FrequencyPip({ frequency }: { frequency: Habit["frequency"] }) {
  const label = frequency === "custom" ? "Custom" : frequency.charAt(0).toUpperCase() + frequency.slice(1);
  return (
    <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Completion toggle button
// ─────────────────────────────────────────────────────────────────────────────

interface ToggleButtonProps {
  done: boolean;
  color: string;
  isLoading: boolean;
  onClick: () => void;
}

function ToggleButton({ done, color, isLoading, onClick }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      aria-label={done ? "Mark as incomplete" : "Mark as complete"}
      aria-pressed={done}
      className={[
        "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        "border-2 transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        "disabled:cursor-not-allowed",
        done
          ? "border-transparent shadow-md"
          : "border-slate-600 bg-transparent hover:border-slate-400 hover:scale-105",
      ].join(" ")}
      style={done ? { backgroundColor: color, boxShadow: `0 0 8px ${color}55` } : {}}
    >
      {isLoading ? (
        <Spinner size="sm" className="text-white" />
      ) : done ? (
        <svg
          viewBox="0 0 12 12"
          className="h-4 w-4 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="1.5,6 4.5,9 10.5,3" />
        </svg>
      ) : null}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main card
// ─────────────────────────────────────────────────────────────────────────────

export interface HabitCardProps {
  habit: Habit;
  isToggling: boolean;
  onToggle: (habitId: string) => void;
  onDelete: (habitId: string) => void;
  onEdit: (habitId: string) => void;
}

function HabitCardComponent({
  habit,
  isToggling,
  onToggle,
  onDelete,
  onEdit,
}: HabitCardProps) {
  const done = isCompletedToday(habit);
  const catStyle = CATEGORY_COLORS[habit.category] ?? CATEGORY_COLORS.other;
  const diff = DIFFICULTY_LABELS[habit.difficulty];

  const handleToggle = useCallback(() => onToggle(habit._id), [onToggle, habit._id]);
  const handleDelete = useCallback(() => onDelete(habit._id), [onDelete, habit._id]);
  const handleEdit   = useCallback(() => onEdit(habit._id),   [onEdit,   habit._id]);

  return (
    <article
      className={[
        "group rounded-xl border bg-slate-900 p-4 transition-all duration-200",
        "hover:border-slate-600 hover:shadow-lg hover:shadow-slate-950/50",
        done
          ? "border-slate-700 opacity-90"
          : "border-slate-800",
      ].join(" ")}
      aria-label={`Habit: ${habit.title}`}
    >
      {/* ── Row 1: Toggle · Title · Streak · XP · Actions ── */}
      <div className="flex items-start gap-3">
        <ToggleButton
          done={done}
          color={habit.color ?? "#3b82f6"}
          isLoading={isToggling}
          onClick={handleToggle}
        />

        {/* Title & description */}
        <div className="min-w-0 flex-1">
          <p
            className={[
              "truncate font-semibold leading-tight transition-colors",
              done ? "text-slate-500 line-through" : "text-slate-100",
            ].join(" ")}
          >
            {habit.title}
          </p>
          {habit.description && (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {habit.description}
            </p>
          )}
        </div>

        {/* Stats cluster */}
        <div className="flex shrink-0 items-center gap-2.5">
          <StreakBadge count={habit.streakCount} longest={habit.longestStreak} size="sm" />
          <XpBadge xpValue={habit.xpValue} difficulty={habit.difficulty} earnedToday={done} size="sm" />
        </div>

        {/* Actions — visible on hover (desktop) or always (mobile) */}
        <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleEdit}
            aria-label="Edit habit"
            className="rounded p-1 text-slate-600 transition-colors hover:bg-slate-800 hover:text-slate-300"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M12.146.854a.5.5 0 0 1 .707 0l2.293 2.293a.5.5 0 0 1 0 .707l-9.5 9.5a.5.5 0 0 1-.168.11l-4 1.5a.5.5 0 0 1-.65-.65l1.5-4a.5.5 0 0 1 .11-.168l9.5-9.5z"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Delete habit"
            className="rounded p-1 text-slate-600 transition-colors hover:bg-red-950 hover:text-red-400"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Row 2: Progress bar ── */}
      <div className="mt-3">
        <ProgressBar
          value={habit.completionRate}
          label={`${habit.title} completion rate`}
          size="sm"
        />
      </div>

      {/* ── Row 3: Meta pills ── */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {/* Category */}
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${catStyle}`}
        >
          {habit.category}
        </span>

        {/* Frequency */}
        <FrequencyPip frequency={habit.frequency} />

        {/* Difficulty */}
        {diff && (
          <span className={`text-[10px] font-medium ${diff.color}`}>
            {diff.label}
          </span>
        )}

        {/* Total completions */}
        <span className="ml-auto text-[10px] tabular-nums text-slate-600">
          {habit.totalCompletions} total
        </span>
      </div>
    </article>
  );
}

// Custom comparator — only re-render when this card's data actually changed
export const HabitCard = React.memo(HabitCardComponent, (prev, next) => {
  return (
    prev.habit._id === next.habit._id &&
    prev.habit.streakCount === next.habit.streakCount &&
    prev.habit.lastCompletedAt === next.habit.lastCompletedAt &&
    prev.habit.totalCompletions === next.habit.totalCompletions &&
    prev.habit.completionRate === next.habit.completionRate &&
    prev.habit.title === next.habit.title &&
    prev.habit.archived === next.habit.archived &&
    prev.isToggling === next.isToggling
  );
});
