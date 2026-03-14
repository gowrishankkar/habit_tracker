import { apiSlice } from "../auth/authApi";

export const todosApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTodos: builder.query({
      query: () => "/todos",
      transformResponse: (res) => res.data,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: "Todos", id: _id })),
              { type: "Todos", id: "LIST" },
            ]
          : [{ type: "Todos", id: "LIST" }],
    }),

    createTodo: builder.mutation({
      query: (body) => ({ url: "/todos", method: "POST", body }),
      transformResponse: (res) => res.data,
      invalidatesTags: [{ type: "Todos", id: "LIST" }],
    }),

    updateTodo: builder.mutation({
      query: ({ id, body }) => ({ url: `/todos/${id}`, method: "PATCH", body }),
      transformResponse: (res) => res.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: "Todos", id }],
    }),

    toggleTodo: builder.mutation({
      query: (id) => ({ url: `/todos/${id}/toggle`, method: "PATCH" }),
      transformResponse: (res) => res.data,
      invalidatesTags: (_result, _error, id) => [{ type: "Todos", id }],
    }),

    deleteTodo: builder.mutation({
      query: (id) => ({ url: `/todos/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Todos", id },
        { type: "Todos", id: "LIST" },
      ],
    }),

    clearCompletedTodos: builder.mutation({
      query: () => ({ url: "/todos/completed", method: "DELETE" }),
      invalidatesTags: [{ type: "Todos", id: "LIST" }],
    }),
  }),
});

export const {
  useGetTodosQuery,
  useCreateTodoMutation,
  useUpdateTodoMutation,
  useToggleTodoMutation,
  useDeleteTodoMutation,
  useClearCompletedTodosMutation,
} = todosApi;
