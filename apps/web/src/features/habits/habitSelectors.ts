/**
 * Habit Selectors
 * ───────────────
 * All derived data is computed with createSelector so that:
 *   1. Components re-render only when their specific slice changes.
 *   2. Expensive filter/sort operations run at most once per unique input.
 *
 * Pattern: selectors that depend on both RTK Query cache data AND Redux slice
 * state use a two-argument signature — the habits array is passed in from
 * the calling component alongside the RootState.
 */

import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";
import type { Habit, HabitCategory, HabitFrequency } from "../../lib/types";
import type { SortBy } from "./habitsSlice";

// ─────────────────────────────────────────────────────────────────────────────
// Raw slice selectors (cheap, no memoization needed)
// ─────────────────────────────────────────────────────────────────────────────

export const selectHabitsUIState = (state: RootState) => state.habits;
export const selectSelectedCategory = (state: RootState) => state.habits.selectedCategory;
export const selectSelectedFrequency = (state: RootState) => state.habits.selectedFrequency;
export const selectSearchQuery = (state: RootState) => state.habits.searchQuery;
export const selectSortBy = (state: RootState) => state.habits.sortBy;
export const selectTogglingIds = (state: RootState) => state.habits.togglingIds;
export const selectShowForm = (state: RootState) => state.habits.showForm;

// ─────────────────────────────────────────────────────────────────────────────
// Today's date key (YYYY-MM-DD in local timezone)
// ─────────────────────────────────────────────────────────────────────────────

export function getTodayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory: createSelectFilteredHabits
//
// Using a factory (returns a new selector instance) rather than a single
// shared selector ensures each component gets its own memoization cache,
// which matters when the same selector is used in multiple components.
// ─────────────────────────────────────────────────────────────────────────────

export function createSelectFilteredHabits() {
  return createSelector(
    // Input 1: habits from RTK Query (passed as second argument)
    (_state: RootState, habits: Habit[]) => habits,
    // Input 2-5: filter/sort state
    selectSelectedCategory,
    selectSelectedFrequency,
    selectSearchQuery,
    selectSortBy,
    // Result function: only re-runs when any input changes
    (
      habits: Habit[],
      category: HabitCategory | "all",
      frequency: HabitFrequency | "all",
      search: string,
      sortBy: SortBy,
    ): Habit[] => {
      let result = habits.filter((h) => !h.archived);

      if (category !== "all") {
        result = result.filter((h) => h.category === category);
      }

      if (frequency !== "all") {
        result = result.filter((h) => h.frequency === frequency);
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        result = result.filter(
          (h) =>
            h.title.toLowerCase().includes(q) ||
            h.description?.toLowerCase().includes(q) ||
            h.category.toLowerCase().includes(q),
        );
      }

      return [...result].sort((a, b) => {
        switch (sortBy) {
          case "streak":
            return b.streakCount - a.streakCount;
          case "title":
            return a.title.localeCompare(b.title);
          case "completionRate":
            return b.completionRate - a.completionRate;
          case "order":
          default:
            return a.order - b.order;
        }
      });
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard stats selector
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalActive: number;
  completedToday: number;
  totalXpToday: number;
  avgStreakCount: number;
  longestCurrentStreak: number;
}

export function createSelectDashboardStats() {
  return createSelector(
    (_state: RootState, habits: Habit[]) => habits,
    (habits: Habit[]): DashboardStats => {
      const active = habits.filter((h) => !h.archived);
      const today = getTodayKey();

      const doneToday = active.filter(
        (h) => h.lastCompletedAt?.slice(0, 10) === today,
      );

      const totalXpToday = doneToday.reduce((sum, h) => sum + h.xpValue, 0);

      const avgStreak =
        active.length > 0
          ? Math.round(
              active.reduce((s, h) => s + h.streakCount, 0) / active.length,
            )
          : 0;

      const longest = active.reduce(
        (max, h) => Math.max(max, h.streakCount),
        0,
      );

      return {
        totalActive: active.length,
        completedToday: doneToday.length,
        totalXpToday,
        avgStreakCount: avgStreak,
        longestCurrentStreak: longest,
      };
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Derive completedToday for a single habit
// ─────────────────────────────────────────────────────────────────────────────

export function isCompletedToday(habit: Habit): boolean {
  if (!habit.lastCompletedAt) return false;
  return habit.lastCompletedAt.slice(0, 10) === getTodayKey();
}
