/**
 * CategoryFilter
 * ──────────────
 * Horizontal pill-button filter bar. On mobile, scrolls horizontally so all
 * categories remain accessible without wrapping to multiple lines.
 *
 * Memoised: only re-renders when selectedCategory or available set changes.
 */

import React, { useCallback } from "react";
import type { HabitCategory } from "../../lib/types";
import { HABIT_CATEGORIES } from "@habit-tracker/shared";

interface CategoryFilterProps {
  selected: HabitCategory | "all";
  /** Only show categories that have at least one habit */
  availableCategories?: Set<HabitCategory>;
  onChange: (category: HabitCategory | "all") => void;
}

const ALL_OPTION = "all" as const;

const CATEGORY_ICONS: Record<string, string> = {
  all:          "✦",
  health:       "❤️",
  fitness:      "💪",
  mindfulness:  "🧘",
  learning:     "📚",
  productivity: "⚡",
  social:       "👥",
  finance:      "💰",
  creativity:   "🎨",
  other:        "📌",
};

export const CategoryFilter = React.memo(function CategoryFilter({
  selected,
  availableCategories,
  onChange,
}: CategoryFilterProps) {
  const handleAll = useCallback(() => onChange(ALL_OPTION), [onChange]);

  const categories: (HabitCategory | "all")[] = [
    ALL_OPTION,
    ...(HABIT_CATEGORIES as HabitCategory[]).filter(
      (c) => !availableCategories || availableCategories.has(c),
    ),
  ];

  return (
    <div
      role="group"
      aria-label="Filter habits by category"
      className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none"
    >
      {categories.map((cat) => {
        const isActive = selected === cat;
        const icon = CATEGORY_ICONS[cat] ?? "📌";
        const label = cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1);

        return (
          <button
            key={cat}
            type="button"
            onClick={cat === "all" ? handleAll : () => onChange(cat as HabitCategory)}
            aria-pressed={isActive}
            className={[
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
              "transition-all duration-150 whitespace-nowrap",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
              isActive
                ? "border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-900/40"
                : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-500 hover:text-slate-200",
            ].join(" ")}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
});
