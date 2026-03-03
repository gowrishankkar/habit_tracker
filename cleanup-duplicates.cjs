/**
 * cleanup-duplicates.cjs
 * ──────────────────────
 * Deletes .ts/.tsx files that have a .js/.jsx counterpart.
 * The .js/.jsx files already contain the production content.
 *
 * Run: node cleanup-duplicates.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "apps/web/src");

// .ts/.tsx files to delete — each has an equivalent .js/.jsx file
const duplicates = [
  "main.tsx",
  "App.tsx",
  "app/store.ts",
  "app/hooks.ts",
  "lib/constants.ts",
  "lib/api.ts",
  "components/ProtectedRoute.tsx",
  "components/ui/Button.tsx",
  "components/ui/Input.tsx",
  "components/layout/Header.tsx",
  "components/layout/Layout.tsx",
  "features/auth/authApi.ts",
  "features/auth/authSlice.ts",
  "features/auth/LoginPage.tsx",
  "features/auth/RegisterPage.tsx",
  "features/habits/habitsApi.ts",
  "features/habits/habitsSlice.ts",
  "features/habits/HabitList.tsx",
  "features/habits/HabitForm.tsx",
];

let deleted = 0;
let skipped = 0;
let errors  = 0;

for (const file of duplicates) {
  const filePath = path.join(ROOT, file);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑  Deleted  ${file}`);
      deleted++;
    } else {
      console.log(`⚠  Skipped  ${file} (not found)`);
      skipped++;
    }
  } catch (e) {
    console.error(`❌ Error    ${file}: ${e.message}`);
    errors++;
  }
}

console.log(`\nDone: ${deleted} deleted, ${skipped} skipped, ${errors} errors.`);

    content: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./app/store";
import { AuthProvider } from "./app/AuthContext";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

/**
 * Register the service worker.
 *
 * registerType: 'prompt' in vite.config means onNeedRefresh fires when a new
 * SW is waiting. We ask the user; if they accept, updateSW(true) posts
 * { type: 'SKIP_WAITING' } to the waiting SW then reloads the page.
 */
const updateSW = registerSW({
  onNeedRefresh() {
    const accepted = window.confirm(
      "A new version of Habit Tracker is available. Reload to update?"
    );
    if (accepted) updateSW(true);
  },
  onOfflineReady() {
    console.info("[PWA] App is ready for offline use.");
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error(
    'Root element #root not found. Check that index.html contains <div id="root">.',
  );
}

createRoot(rootElement).render(
  <StrictMode>
    {/*
      Provider must wrap AuthProvider because AuthProvider calls useDispatch()
      internally to sync login/logout state into the Redux auth slice.
    */}
    <Provider store={store}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Provider>
  </StrictMode>,
);
`,
  },

  // App: analytics route + OfflineBanner + lazy loading
  {
    from: "App.tsx",
    to: "App.jsx",
    content: `import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Layout } from "./components/layout/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import HabitList from "./features/habits/HabitList";
import { Spinner } from "./components/ui/Spinner";
import { OfflineBanner } from "./components/ui/OfflineBanner";
import { ROUTES } from "./lib/constants";

// Lazy-load the analytics bundle — it pulls in Recharts (~200 kB) which we
// don't want in the initial JS chunk.
const AnalyticsDashboard = lazy(
  () => import("./features/analytics/AnalyticsDashboard"),
);

export default function App() {
  return (
    <BrowserRouter>
      {/* Fixed banner — rendered outside Route tree so it's always visible */}
      <OfflineBanner />
      <Routes>
        <Route element={<Layout />}>
          <Route
            path={ROUTES.HOME}
            element={
              <ProtectedRoute>
                <HabitList />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.ANALYTICS}
            element={
              <ProtectedRoute>
                <Suspense
                  fallback={
                    <div className="flex h-64 items-center justify-center">
                      <Spinner size="lg" />
                    </div>
                  }
                >
                  <AnalyticsDashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
`,
  },

  // store: add gamification reducer
  {
    from: "app/store.ts",
    to: "app/store.js",
    content: `import { configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "../features/auth/authApi";
import authReducer from "../features/auth/authSlice";
import habitsReducer from "../features/habits/habitsSlice";
import gamificationReducer from "../features/gamification/gamificationSlice";

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
    habits: habitsReducer,
    gamification: gamificationReducer,
  },
  middleware: (getDefault) => getDefault().concat(apiSlice.middleware),
});
`,
  },

  // constants: add ANALYTICS route
  {
    from: "lib/constants.ts",
    to: "lib/constants.js",
    content: `export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  ANALYTICS: "/analytics",
};
`,
  },

  // authApi: add Analytics tagType, cleaner structure (strip type imports/generics)
  {
    from: "features/auth/authApi.ts",
    to: "features/auth/authApi.js",
    content: `import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

/**
 * RTK Query base slice.
 *
 * Why RTK Query instead of hand-rolled fetch?
 * ────────────────────────────────────────────
 * RTK Query eliminates manual loading/error/caching state entirely.
 * Each endpoint declaration auto-generates a hook with built-in:
 *   - Deduplication of identical in-flight requests
 *   - Automatic cache invalidation via tags
 *   - Re-fetch on window focus / reconnect
 *
 * Feature endpoints are injected via injectEndpoints() so code-splitting
 * remains possible — each feature only loads what it needs.
 */
export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: BASE_URL,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem("token");
      if (token) headers.set("Authorization", \`Bearer \${token}\`);
      return headers;
    },
  }),
  tagTypes: ["Habits", "Analytics"],
  endpoints: () => ({}),
});

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
    }),
    register: builder.mutation({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
    }),
    refreshTokens: builder.mutation({
      query: (body) => ({ url: "/auth/refresh", method: "POST", body }),
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation, useRefreshTokensMutation } =
  authApi;
`,
  },

  // habitsSlice: full slice with all filter/sort reducers (strip types)
  {
    from: "features/habits/habitsSlice.ts",
    to: "features/habits/habitsSlice.js",
    content: `import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  showForm: false,
  editingId: null,
  /** "all" means no filter */
  selectedCategory: "all",
  selectedFrequency: "all",
  searchQuery: "",
  sortBy: "order",
  /** Track per-habit optimistic toggle state to prevent double-clicks */
  togglingIds: [],
};

const habitsSlice = createSlice({
  name: "habits",
  initialState,
  reducers: {
    openForm(state) {
      state.showForm = true;
      state.editingId = null;
    },
    editHabit(state, action) {
      state.showForm = true;
      state.editingId = action.payload;
    },
    closeForm(state) {
      state.showForm = false;
      state.editingId = null;
    },
    setCategory(state, action) {
      state.selectedCategory = action.payload;
    },
    setFrequency(state, action) {
      state.selectedFrequency = action.payload;
    },
    setSearchQuery(state, action) {
      state.searchQuery = action.payload;
    },
    setSortBy(state, action) {
      state.sortBy = action.payload;
    },
    addTogglingId(state, action) {
      if (!state.togglingIds.includes(action.payload)) {
        state.togglingIds.push(action.payload);
      }
    },
    removeTogglingId(state, action) {
      state.togglingIds = state.togglingIds.filter((id) => id !== action.payload);
    },
  },
});

export const {
  openForm,
  editHabit,
  closeForm,
  setCategory,
  setFrequency,
  setSearchQuery,
  setSortBy,
  addTogglingId,
  removeTogglingId,
} = habitsSlice.actions;

export default habitsSlice.reducer;
`,
  },

  // habitsApi: production version with optimistic updates + offline queue (strip types)
  {
    from: "features/habits/habitsApi.ts",
    to: "features/habits/habitsApi.js",
    content: `/**
 * Habits RTK Query endpoints
 *
 * Toggle uses optimistic updates — the UI responds instantly while the
 * request is in-flight, then reconciles with the real server response.
 *
 * Offline behaviour:
 *   When the toggle fetch fails with a network error (FETCH_ERROR), the
 *   optimistic update is kept visible and the operation is queued in
 *   IndexedDB for Background Sync replay.
 */
import { apiSlice } from "../auth/authApi";
import { addGamificationEvent } from "../gamification/gamificationSlice";
import { enqueueOperation, registerBackgroundSync } from "../../lib/offlineQueue";
import { tokenStore } from "../../lib/tokenStore";

/** "YYYY-MM-DD" in the user's local timezone */
function todayKey() {
  return new Date().toLocaleDateString("en-CA"); // en-CA → ISO 8601 format
}

export const habitsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getHabits: builder.query({
      query: () => "/habits",
      transformResponse: (res) => res.data,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: "Habits", id: _id })),
              { type: "Habits", id: "LIST" },
            ]
          : [{ type: "Habits", id: "LIST" }],
    }),

    createHabit: builder.mutation({
      query: (body) => ({ url: "/habits", method: "POST", body }),
      transformResponse: (res) => res.data,
      invalidatesTags: [{ type: "Habits", id: "LIST" }],
    }),

    updateHabit: builder.mutation({
      query: ({ id, body }) => ({ url: \`/habits/\${id}\`, method: "PATCH", body }),
      transformResponse: (res) => res.data,
      invalidatesTags: (_r, _e, { id }) => [{ type: "Habits", id }],
    }),

    deleteHabit: builder.mutation({
      query: (id) => ({ url: \`/habits/\${id}\`, method: "DELETE" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Habits", id },
        { type: "Habits", id: "LIST" },
      ],
    }),

    toggleCompletion: builder.mutation({
      query: ({ id, date }) => ({
        url: \`/habits/\${id}/toggle\`,
        method: "POST",
        body: { date: date ?? todayKey(), today: todayKey() },
      }),
      transformResponse: (res) => res.data,

      // ── Optimistic update ─────────────────────────────────────────────
      async onQueryStarted({ id, date }, { dispatch, queryFulfilled }) {
        const dateKeyToToggle = date ?? todayKey();

        const patchResult = dispatch(
          habitsApi.util.updateQueryData("getHabits", undefined, (draft) => {
            const habit = draft.find((h) => h._id === id);
            if (!habit) return;

            const wasCompleted =
              habit.lastCompletedAt?.slice(0, 10) === dateKeyToToggle;

            if (wasCompleted) {
              habit.lastCompletedAt = null;
              habit.streakCount = Math.max(0, habit.streakCount - 1);
              habit.totalCompletions = Math.max(0, habit.totalCompletions - 1);
            } else {
              habit.lastCompletedAt = new Date().toISOString();
              habit.streakCount += 1;
              if (habit.streakCount > habit.longestStreak) {
                habit.longestStreak = habit.streakCount;
              }
              habit.totalCompletions += 1;
            }
          }),
        );

        try {
          const { data } = await queryFulfilled;

          // Replace optimistic data with authoritative habit from server
          dispatch(
            habitsApi.util.updateQueryData("getHabits", undefined, (draft) => {
              const idx = draft.findIndex((h) => h._id === id);
              if (idx !== -1) draft[idx] = data.habit;
            }),
          );

          // Fire gamification toast if XP was gained
          if (data.gamification && data.gamification.xpGained > 0) {
            dispatch(
              addGamificationEvent({
                id: crypto.randomUUID(),
                habitTitle: data.habit.title,
                ...data.gamification,
              }),
            );
          }
        } catch (err) {
          const isNetworkError =
            err !== null &&
            typeof err === "object" &&
            "error" in err &&
            err.error?.status === "FETCH_ERROR";

          if (isNetworkError) {
            // Keep optimistic update; queue for Background Sync
            await enqueueOperation({
              id: crypto.randomUUID(),
              type: "TOGGLE",
              url: \`/api/habits/\${id}/toggle\`,
              method: "POST",
              body: { date: dateKeyToToggle, today: todayKey() },
              timestamp: Date.now(),
              retries: 0,
              authToken: tokenStore.getAccessToken(),
            });
            await registerBackgroundSync();
          } else {
            patchResult.undo();
          }
        }
      },
    }),
  }),
});

export const {
  useGetHabitsQuery,
  useCreateHabitMutation,
  useUpdateHabitMutation,
  useDeleteHabitMutation,
  useToggleCompletionMutation,
} = habitsApi;
`,
  },

  // HabitList: production dashboard (strip types)
  {
    from: "features/habits/HabitList.tsx",
    to: "features/habits/HabitList.jsx",
    content: `/**
 * HabitList — Habit Dashboard
 * ────────────────────────────
 * Rendering optimizations:
 *   - HabitCard is React.memo with a custom comparator
 *   - createSelectFilteredHabits is a memoised selector factory
 *   - useCallback for all handlers so child props are stable
 *   - toggle IDs tracked in Redux to prevent double-click
 */

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
    selectedCategory !== "all" ||
    selectedFrequency !== "all" ||
    searchQuery.trim() !== "";

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

  const handleCategoryChange = useCallback(
    (cat) => dispatch(setCategory(cat)),
    [dispatch],
  );

  const handleSearchChange = useCallback(
    (q) => dispatch(setSearchQuery(q)),
    [dispatch],
  );

  const handleSortChange = useCallback(
    (e) => dispatch(setSortBy(e.target.value)),
    [dispatch],
  );

  return (
    <div className="space-y-5">
      <GamificationToast />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            {user ? \`\${user.name.split(" ")[0]}'s Habits\` : "My Habits"}
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
          onChange={handleCategoryChange}
        />

        <div className="flex items-center gap-2">
          <SearchInput value={searchQuery} onChange={handleSearchChange} />

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
            onChange={handleSortChange}
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
          <button
            type="button"
            onClick={refetch}
            className="text-sm font-medium text-red-300 hover:text-red-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
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
`,
  },

  // LoginPage: production with useAuth + card UI (strip TS type cast)
  {
    from: "features/auth/LoginPage.tsx",
    to: "features/auth/LoginPage.jsx",
    content: `/**
 * LoginPage — full-page login screen with card UI, redirect-after-login,
 * and redirect away if already authenticated.
 */

import { useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LoginForm } from "./LoginForm";
import { useAuth } from "../../app/useAuth";
import { Spinner } from "../../components/ui/Spinner";
import { ROUTES } from "../../lib/constants";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isInitializing } = useAuth();

  const from = location.state?.from ?? ROUTES.HOME;

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isInitializing, navigate, from]);

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Spinner size="lg" className="text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl shadow-lg shadow-blue-900/50">
          🔥
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Sign in to continue your streaks
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl shadow-slate-950/50">
        <LoginForm onSuccess={() => navigate(from, { replace: true })} />

        <div className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link
            to={ROUTES.REGISTER}
            className="font-medium text-blue-400 transition-colors hover:text-blue-300"
          >
            Create one
          </Link>
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-600">
        © {new Date().getFullYear()} Habit Tracker. All rights reserved.
      </p>
    </div>
  );
}
`,
  },

  // RegisterPage: production with useAuth + card UI
  {
    from: "features/auth/RegisterPage.tsx",
    to: "features/auth/RegisterPage.jsx",
    content: `/**
 * RegisterPage — full-page registration screen with card UI, redirect on
 * success, and redirect away if already authenticated.
 */

import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RegisterForm } from "./RegisterForm";
import { useAuth } from "../../app/useAuth";
import { Spinner } from "../../components/ui/Spinner";
import { ROUTES } from "../../lib/constants";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isInitializing } = useAuth();

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate(ROUTES.HOME, { replace: true });
    }
  }, [isAuthenticated, isInitializing, navigate]);

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Spinner size="lg" className="text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl shadow-lg shadow-blue-900/50">
          🔥
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Start building habits
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Create your free account — no credit card required
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl shadow-slate-950/50">
        <RegisterForm onSuccess={() => navigate(ROUTES.HOME, { replace: true })} />

        <div className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            to={ROUTES.LOGIN}
            className="font-medium text-blue-400 transition-colors hover:text-blue-300"
          >
            Sign in
          </Link>
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-600">
        © {new Date().getFullYear()} Habit Tracker. All rights reserved.
      </p>
    </div>
  );
}
`,
  },

  // ProtectedRoute: production with isInitializing + spinner (strip types)
  {
    from: "components/ProtectedRoute.tsx",
    to: "components/ProtectedRoute.jsx",
    content: `import { Navigate } from "react-router-dom";
import { useAuth } from "../app/useAuth";
import { Spinner } from "./ui/Spinner";
import { ROUTES } from "../lib/constants";

/**
 * Guards a route behind authentication.
 *
 * During the initial auth rehydration (fetching /users/me on first load),
 * renders a full-screen spinner so the user never sees a flash of the login
 * page before being redirected back.
 */
export function ProtectedRoute({ children, redirectTo = ROUTES.LOGIN }) {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Spinner size="lg" className="text-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
`,
  },

  // Button: production with variants, loading state, icons (strip types)
  {
    from: "components/ui/Button.tsx",
    to: "components/ui/Button.jsx",
    content: `import { Spinner } from "./Spinner";

const variantClasses = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 " +
    "focus-visible:ring-blue-500 disabled:bg-blue-800 disabled:text-blue-300",
  secondary:
    "bg-slate-700 text-slate-100 hover:bg-slate-600 active:bg-slate-800 " +
    "focus-visible:ring-slate-500 disabled:bg-slate-800 disabled:text-slate-500",
  ghost:
    "bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white " +
    "focus-visible:ring-slate-500 disabled:text-slate-600",
  danger:
    "bg-red-700 text-white hover:bg-red-600 active:bg-red-800 " +
    "focus-visible:ring-red-500 disabled:bg-red-900 disabled:text-red-400",
};

const sizeClasses = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  loadingText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  children,
  className = "",
  ...props
}) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      disabled={isDisabled}
      aria-busy={isLoading}
      className={[
        "inline-flex items-center justify-center rounded-lg font-medium",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        "disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner size="sm" />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        <>
          {leftIcon}
          <span>{children}</span>
          {rightIcon}
        </>
      )}
    </button>
  );
}
`,
  },

  // Input: production with label, error, hint, addons (strip types)
  {
    from: "components/ui/Input.tsx",
    to: "components/ui/Input.jsx",
    content: `import { forwardRef } from "react";

/**
 * Fully-controlled input with optional label, inline error and hint text.
 * Forwarded ref so react-hook-form's register() works transparently.
 */
export const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    id,
    leftAddon,
    rightAddon,
    className = "",
    ...props
  },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\\s+/g, "-");
  const hasError = Boolean(error);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-300"
        >
          {label}
          {props.required && (
            <span className="ml-0.5 text-red-400" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative">
        {leftAddon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            {leftAddon}
          </div>
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={hasError}
          aria-describedby={
            error ? \`\${inputId}-error\` : hint ? \`\${inputId}-hint\` : undefined
          }
          className={[
            "w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-slate-100",
            "placeholder:text-slate-500",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950",
            hasError
              ? "border-red-600 focus:ring-red-500"
              : "border-slate-700 focus:border-blue-500 focus:ring-blue-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            leftAddon ? "pl-9" : "",
            rightAddon ? "pr-9" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {rightAddon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
            {rightAddon}
          </div>
        )}
      </div>

      {hint && !error && (
        <p id={\`\${inputId}-hint\`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={\`\${inputId}-error\`}
          role="alert"
          className="flex items-center gap-1 text-xs text-red-400"
        >
          <span aria-hidden="true">✕</span>
          {error}
        </p>
      )}
    </div>
  );
});
`,
  },
];

// ── Files to delete (no migration needed — .js/.jsx is already correct) ──────
const toDelete = [
  // These .ts/.tsx are old stubs; .js/.jsx already has production content
  "components/layout/Header.tsx",   // Header.jsx has sticky + backdrop-blur
  "components/layout/Layout.tsx",   // Layout.jsx has max-w-5xl
  "features/auth/authSlice.ts",     // authSlice.js is more complete
  "app/hooks.ts",                   // hooks.js is equivalent
  "lib/api.ts",                     // api.js is fine
  // These are handled by the migrations array above:
  "main.tsx",
  "App.tsx",
  "app/store.ts",
  "lib/constants.ts",
  "features/auth/authApi.ts",
  "features/habits/habitsSlice.ts",
  "features/habits/habitsApi.ts",
  "features/habits/HabitList.tsx",
  "features/auth/LoginPage.tsx",
  "features/auth/RegisterPage.tsx",
  "components/ProtectedRoute.tsx",
  "components/ui/Button.tsx",
  "components/ui/Input.tsx",
];

// ── Execute ───────────────────────────────────────────────────────────────────

let migrated = 0;
let deleted = 0;
let errors = 0;

// 1. Write migrated content to .js/.jsx files
for (const { from, to, content } of migrations) {
  const toPath = path.join(ROOT, to);
  try {
    fs.writeFileSync(toPath, content, "utf8");
    console.log(`✅ Migrated → ${to}`);
    migrated++;
  } catch (e) {
    console.error(`❌ Failed to write ${to}:`, e.message);
    errors++;
  }
}

// 2. Delete .ts/.tsx files
for (const file of toDelete) {
  const filePath = path.join(ROOT, file);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑  Deleted  ${file}`);
      deleted++;
    } else {
      console.log(`⚠  Skipped  ${file} (not found)`);
    }
  } catch (e) {
    console.error(`❌ Failed to delete ${file}:`, e.message);
    errors++;
  }
}

console.log(`\nDone: ${migrated} migrated, ${deleted} deleted, ${errors} errors.`);
