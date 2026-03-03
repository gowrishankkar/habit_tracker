import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./AuthContext";

/**
 * Returns the current auth context value.
 * Throws if called outside of <AuthProvider> — this is intentional so that
 * missing providers surface immediately during development.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuth() must be called inside an <AuthProvider>. " +
        "Wrap your app (or the relevant subtree) with <AuthProvider>.",
    );
  }
  return ctx;
}
