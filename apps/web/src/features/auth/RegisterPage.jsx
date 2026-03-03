import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RegisterForm } from "./RegisterForm";
import { useAuth } from "../../app/useAuth";
import { Spinner } from "../../components/ui/Spinner";
import { ROUTES } from "../../lib/constants";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isInitializing } = useAuth();

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate(ROUTES.HOME, { replace: true });
    }
  }, [isAuthenticated, isInitializing, navigate]);

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
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Start building habits</h1>
        <p className="mt-1 text-sm text-slate-400">Create your free account — no credit card required</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl shadow-slate-950/50">
        <RegisterForm onSuccess={() => navigate(ROUTES.HOME, { replace: true })} />

        <div className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to={ROUTES.LOGIN} className="font-medium text-blue-400 transition-colors hover:text-blue-300">
            Sign in
          </Link>
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-600">
        © {new Date().getFullYear()} Habit Tracker. All rights reserved.
      </p>
    </div>
  );
}
