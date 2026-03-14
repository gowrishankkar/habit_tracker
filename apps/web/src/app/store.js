import { configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "../features/auth/authApi";
import authReducer from "../features/auth/authSlice";
import habitsReducer from "../features/habits/habitsSlice";
import gamificationReducer from "../features/gamification/gamificationSlice";
import todosReducer from "../features/todos/todosSlice";

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
    habits: habitsReducer,
    gamification: gamificationReducer,
    todos: todosReducer,
  },
  middleware: (getDefault) => getDefault().concat(apiSlice.middleware),
});
