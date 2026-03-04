/**
 * Gamification Slice
 * ──────────────────
 * Stores a queue of GamificationEvents to display as toasts.
 *
 * Events are added by habitsApi.ts after a successful toggle response.
 * The GamificationToast component drains them after display.
 *
 * Max queue size = 5: if the user completes habits very rapidly, older
 * notifications are discarded to prevent a screen-filling stack.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { GamificationEvent } from "../../lib/types";

interface GamificationState {
  events: GamificationEvent[];
}

const initialState: GamificationState = { events: [] };

const MAX_QUEUE = 5;

const gamificationSlice = createSlice({
  name: "gamification",
  initialState,
  reducers: {
    addGamificationEvent(state, action: PayloadAction<GamificationEvent>) {
      state.events = [...state.events, action.payload].slice(-MAX_QUEUE);
    },
    dismissEvent(state, action: PayloadAction<string>) {
      state.events = state.events.filter((e) => e.id !== action.payload);
    },
    clearAllEvents(state) {
      state.events = [];
    },
  },
});

export const { addGamificationEvent, dismissEvent, clearAllEvents } =
  gamificationSlice.actions;

export default gamificationSlice.reducer;
