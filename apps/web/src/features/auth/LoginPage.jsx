import { useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LoginForm } from "./LoginForm";
import { useAuth } from "../../app/useAuth";
import { Spinner } from "../../components/ui/Spinner";
import { ROUTES } from "../../lib/constants";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isInitializing } = useAuth();

  const from = location.state?.from ?? ROUTES.HOME;

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isInitializing, navigate, from]);

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Spinner size="lg" className="text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl shadow-lg shadow-blue-900/50">
          🔥
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-400">Sign in to continue your streaks</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl shadow-slate-950/50">
        <LoginForm onSuccess={() => navigate(from, { replace: true })} />

        <div className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link to={ROUTES.REGISTER} className="font-medium text-blue-400 transition-colors hover:text-blue-300">
            Create one
          </Link>
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-600">
        © {new Date().getFullYear()} Habit Tracker. All rights reserved.
      </p>
    </div>
  );
}
