import React from "react";

interface EmptyStateProps {
  hasFilters?: boolean;
  onClearFilters?: () => void;
  onCreateHabit?: () => void;
}

export const EmptyState = React.memo(function EmptyState({
  hasFilters = false,
  onClearFilters,
  onCreateHabit,
}: EmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-800 py-16 text-center">
        <span className="text-4xl" aria-hidden="true">🔍</span>
        <div>
          <p className="font-semibold text-slate-300">No habits match your filters</p>
          <p className="mt-1 text-sm text-slate-500">
            Try a different category, frequency, or search term.
          </p>
        </div>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
          >
            Clear all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-800 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-3xl shadow-inner">
        🌱
      </div>
      <div>
        <p className="text-lg font-semibold text-slate-200">No habits yet</p>
        <p className="mt-1 max-w-xs text-sm text-slate-500">
          Build your first habit and start tracking your progress. Small steps
          lead to big changes.
        </p>
      </div>
      {onCreateHabit && (
        <button
          type="button"
          onClick={onCreateHabit}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-900/40 transition-colors hover:bg-blue-500 active:bg-blue-700"
        >
          <span aria-hidden="true">+</span>
          Create my first habit
        </button>
      )}
    </div>
  );
});
