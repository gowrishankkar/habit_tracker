import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  showForm: false,
  editingId: null,
  selectedCategory: "all",
  selectedFrequency: "all",
  searchQuery: "",
  sortBy: "order",
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
