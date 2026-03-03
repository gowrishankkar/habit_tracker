import { Navigate } from "react-router-dom";
import { useAuth } from "../app/useAuth";
import { Spinner } from "./ui/Spinner";
import { ROUTES } from "../lib/constants";

/**
 * Guards a route behind authentication.
 * During initial auth rehydration, shows a spinner to prevent flash of login page.
 */
export function ProtectedRoute({ children, redirectTo = ROUTES.LOGIN }) {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Spinner size="lg" className="text-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
