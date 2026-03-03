import { configureStore } from "@reduxjs/toolkit";
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
