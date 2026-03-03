import { apiSlice } from "../auth/authApi";
import { addGamificationEvent } from "../gamification/gamificationSlice";
import { enqueueOperation, registerBackgroundSync } from "../../lib/offlineQueue";
import { tokenStore } from "../../lib/tokenStore";

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
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
      query: ({ id, body }) => ({ url: `/habits/${id}`, method: "PATCH", body }),
      transformResponse: (res) => res.data,
      invalidatesTags: (_r, _e, { id }) => [{ type: "Habits", id }],
    }),

    deleteHabit: builder.mutation({
      query: (id) => ({ url: `/habits/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Habits", id },
        { type: "Habits", id: "LIST" },
      ],
    }),

    toggleCompletion: builder.mutation({
      query: ({ id, date }) => ({
        url: `/habits/${id}/toggle`,
        method: "POST",
        body: { date: date ?? todayKey(), today: todayKey() },
      }),
      transformResponse: (res) => res.data,

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

          dispatch(
            habitsApi.util.updateQueryData("getHabits", undefined, (draft) => {
              const idx = draft.findIndex((h) => h._id === id);
              if (idx !== -1) draft[idx] = data.habit;
            }),
          );

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
            await enqueueOperation({
              id: crypto.randomUUID(),
              type: "TOGGLE",
              url: `/api/habits/${id}/toggle`,
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
