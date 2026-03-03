/**
 * AuthContext
 * ───────────
 * Provides application-wide auth state and the login / register / logout
 * actions. Components consume this via the `useAuth` hook.
 *
 * Responsibilities:
 *   1. Rehydrate the user from a stored access token on first mount
 *      (calls GET /users/me so user data is always fresh).
 *   2. Expose typed login / register / logout async functions.
 *   3. Sync with Redux so RTK Query's prepareHeaders keeps working.
 *   4. Listen for the global "auth:logout" event fired by the axios
 *      interceptor when a token refresh fails — forces React state clean-up
 *      even when no component is currently calling an auth method.
 */

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useDispatch } from "react-redux";
import { axiosInstance } from "../lib/axios";
import { tokenStore } from "../lib/tokenStore";
import { setCredentials, logout as reduxLogout } from "../features/auth/authSlice";
import type { User, AuthResponse, LoginInput, RegisterInput, ApiSuccess } from "../lib/types";
import type { AppDispatch } from "./store";

// ─────────────────────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: User | null;
  /** True once the initial /users/me rehydration attempt has completed. */
  isInitializing: boolean;
  /** Derived: user is not null OR a valid access token is stored. */
  isAuthenticated: boolean;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // ── Global force-logout listener (fired by axios interceptor) ───────────
  useEffect(() => {
    const onForceLogout = () => {
      setUser(null);
      dispatch(reduxLogout());
    };
    window.addEventListener("auth:logout", onForceLogout);
    return () => window.removeEventListener("auth:logout", onForceLogout);
  }, [dispatch]);

  // ── Cold-start rehydration ───────────────────────────────────────────────
  // If an access token exists in localStorage, fetch fresh user data so that
  // user profile info is never stale after a page reload.
  useEffect(() => {
    if (!tokenStore.hasAccessToken()) {
      setIsInitializing(false);
      return;
    }

    axiosInstance
      .get<ApiSuccess<User>>("/users/me")
      .then(({ data }) => setUser(data.data))
      .catch(() => {
        // Refresh already failed inside the interceptor; tokens cleared.
        tokenStore.clear();
      })
      .finally(() => setIsInitializing(false));
  }, []);

  // ── Auth actions ─────────────────────────────────────────────────────────

  const login = useCallback(
    async (input: LoginInput) => {
      const { data } = await axiosInstance.post<ApiSuccess<AuthResponse>>(
        "/auth/login",
        input,
      );
      const { tokens, user: userData } = data.data;
      tokenStore.setTokens(tokens);
      dispatch(setCredentials({ tokens, user: userData }));
      setUser(userData);
    },
    [dispatch],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const { data } = await axiosInstance.post<ApiSuccess<AuthResponse>>(
        "/auth/register",
        input,
      );
      const { tokens, user: userData } = data.data;
      tokenStore.setTokens(tokens);
      dispatch(setCredentials({ tokens, user: userData }));
      setUser(userData);
    },
    [dispatch],
  );

  const logout = useCallback(() => {
    // Best-effort: tell the server to revoke the refresh token.
    // Fire-and-forget — we never wait for this to finish.
    axiosInstance.post("/auth/logout").catch(() => {});
    tokenStore.clear();
    dispatch(reduxLogout());
    setUser(null);
  }, [dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  // Value (memoised to prevent unnecessary re-renders)
  // ─────────────────────────────────────────────────────────────────────────

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isInitializing,
      isAuthenticated: user !== null || tokenStore.hasAccessToken(),
      login,
      register,
      logout,
    }),
    [user, isInitializing, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
