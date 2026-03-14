import { createSlice } from "@reduxjs/toolkit";

const initialState = { filter: "all" };

const todosSlice = createSlice({
  name: "todos",
  initialState,
  reducers: {
    setTodoFilter(state, action) {
      state.filter = action.payload;
    },
  },
});

export const { setTodoFilter } = todosSlice.actions;
export const selectTodoFilter = (state) => state.todos.filter;

export default todosSlice.reducer;
