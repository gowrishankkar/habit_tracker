import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  openForm,
  editHabit,
  setCategory,
  setFrequency,
  setSortBy,
  setSearchQuery,
} from "./habitsSlice";
import {
  useGetHabitsQuery,
  useDeleteHabitMutation,
  useToggleCompletionMutation,
} from "./habitsApi";
import {
  createSelectFilteredHabits,
  createSelectDashboardStats,
  selectSelectedCategory,
  selectSelectedFrequency,
  selectSortBy,
  selectSearchQuery,
  selectTogglingIds,
  selectShowForm,
} from "./habitSelectors";
import { HabitCard } from "./HabitCard";
import { CategoryFilter } from "./CategoryFilter";
import { DashboardStats } from "./DashboardStats";
import { EmptyState } from "./EmptyState";
import { StreakBadge } from "./StreakBadge";
import { Button } from "../../components/ui/Button";
import HabitForm from "./HabitForm";
import { GamificationToast } from "../gamification/GamificationToast";
import { useAuth } from "../../app/useAuth";

const SORT_OPTIONS = [
  { value: "order",          label: "Custom order" },
  { value: "streak",         label: "Streak"       },
  { value: "completionRate", label: "Completion"   },
  { value: "title",          label: "A → Z"        },
];

function SearchInput({ value, onChange }) {
  const [local, setLocal] = useState(value);
  const timer = useRef(null);

  useEffect(() => {
    if (value === "" && local !== "") setLocal("");
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    setLocal(e.target.value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(e.target.value), 250);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
        </svg>
      </span>
      <input
        type="search"
        value={local}
        onChange={handleChange}
        placeholder="Search habits…"
        aria-label="Search habits"
        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 shrink-0 rounded-full bg-slate-800" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-3/4 rounded bg-slate-800" />
          <div className="h-2.5 w-1/2 rounded bg-slate-800/60" />
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800" />
      <div className="mt-2.5 flex gap-1.5">
        <div className="h-4 w-16 rounded-full bg-slate-800" />
        <div className="h-4 w-10 rounded bg-slate-800" />
      </div>
    </div>
  );
}

export default function HabitList() {
  const dispatch = useAppDispatch();
  const { user } = useAuth();

  const { data: habits = [], isLoading, isError, refetch } = useGetHabitsQuery();
  const [toggleCompletion] = useToggleCompletionMutation();
  const [deleteHabit] = useDeleteHabitMutation();

  const showForm          = useAppSelector(selectShowForm);
  const selectedCategory  = useAppSelector(selectSelectedCategory);
  const selectedFrequency = useAppSelector(selectSelectedFrequency);
  const sortBy            = useAppSelector(selectSortBy);
  const searchQuery       = useAppSelector(selectSearchQuery);
  const togglingIds       = useAppSelector(selectTogglingIds);

  const selectFiltered = useMemo(createSelectFilteredHabits, []);
  const selectStats    = useMemo(createSelectDashboardStats, []);

  const filteredHabits = useAppSelector((state) => selectFiltered(state, habits));
  const stats          = useAppSelector((state) => selectStats(state, habits));

  const availableCategories = useMemo(
    () => new Set(habits.filter((h) => !h.archived).map((h) => h.category)),
    [habits],
  );

  const hasActiveFilters =
    selectedCategory !== "all" || selectedFrequency !== "all" || searchQuery.trim() !== "";

  const handleToggle = useCallback(
    async (habitId) => {
      if (togglingIds.includes(habitId)) return;
      await toggleCompletion({ id: habitId });
    },
    [toggleCompletion, togglingIds],
  );

  const handleDelete = useCallback(
    (habitId) => {
      if (window.confirm("Delete this habit? This cannot be undone.")) {
        deleteHabit(habitId);
      }
    },
    [deleteHabit],
  );

  const handleEdit = useCallback(
    (habitId) => { dispatch(editHabit(habitId)); },
    [dispatch],
  );

  const handleClearFilters = useCallback(() => {
    dispatch(setCategory("all"));
    dispatch(setFrequency("all"));
    dispatch(setSearchQuery(""));
  }, [dispatch]);

  return (
    <div className="space-y-5">
      <GamificationToast />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            {user ? `${user.name.split(" ")[0]}'s Habits` : "My Habits"}
          </h1>
          {user && (
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <span>Level {user.level}</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400">⚡ {user.xp} XP</span>
              <span aria-hidden="true">·</span>
              <StreakBadge count={stats.longestCurrentStreak} size="sm" />
            </div>
          )}
        </div>
        <Button
          onClick={() => dispatch(openForm())}
          leftIcon={<span aria-hidden="true">+</span>}
          disabled={showForm}
        >
          New Habit
        </Button>
      </div>

      {showForm && <div><HabitForm /></div>}

      <DashboardStats stats={stats} isLoading={isLoading} />

      <div className="space-y-3">
        <CategoryFilter
          selected={selectedCategory}
          availableCategories={availableCategories}
          onChange={(cat) => dispatch(setCategory(cat))}
        />

        <div className="flex items-center gap-2">
          <SearchInput value={searchQuery} onChange={(q) => dispatch(setSearchQuery(q))} />

          <select
            value={selectedFrequency}
            onChange={(e) => dispatch(setFrequency(e.target.value))}
            aria-label="Filter by frequency"
            className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2 text-xs text-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All frequencies</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => dispatch(setSortBy(e.target.value))}
            aria-label="Sort habits"
            className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2 text-xs text-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              Showing {filteredHabits.length} of {habits.filter((h) => !h.archived).length} habits
            </span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="ml-auto text-blue-400 hover:text-blue-300 transition-colors"
            >
              Clear filters ×
            </button>
          </div>
        )}
      </div>

      {isError && (
        <div className="flex items-center justify-between rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3">
          <p className="text-sm text-red-400">Failed to load habits.</p>
          <button type="button" onClick={refetch} className="text-sm font-medium text-red-300 hover:text-red-100 transition-colors">
            Retry
          </button>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!isLoading && filteredHabits.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Habits list">
          {filteredHabits.map((habit) => (
            <li key={habit._id}>
              <HabitCard
                habit={habit}
                isToggling={togglingIds.includes(habit._id)}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            </li>
          ))}
        </ul>
      )}

      {!isLoading && filteredHabits.length === 0 && !isError && (
        <EmptyState
          hasFilters={hasActiveFilters}
          onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
          onCreateHabit={!hasActiveFilters ? () => dispatch(openForm()) : undefined}
        />
      )}
    </div>
  );
}
