import { createSlice } from "@reduxjs/toolkit";

/**
 * Auth slice — stores the current user and access token in Redux.
 *
 * Token storage strategy:
 *   accessToken  → Redux state + localStorage  (read by RTK Query prepareHeaders)
 *   refreshToken → localStorage only           (sent only on /auth/refresh calls)
 *
 * Both are cleared on logout so there is no way to silently re-authenticate
 * from a previous session after an explicit sign-out.
 */
const initialState = {
  user: null,
  token: localStorage.getItem("token"),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /**
     * Called after a successful login or register.
     * Payload shape: { tokens: { accessToken, refreshToken }, user }
     */
    setCredentials(state, action) {
      const { tokens, user } = action.payload;
      state.user = user;
      state.token = tokens.accessToken;
      localStorage.setItem("token", tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);
    },

    /** Single-device logout: clears state and both stored tokens. */
    logout(state) {
      state.user = null;
      state.token = null;
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
