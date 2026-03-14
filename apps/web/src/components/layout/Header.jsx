import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { logout } from "../../features/auth/authSlice";
import { Button } from "../ui/Button";
import { NavLink } from "react-router-dom";
import { ROUTES } from "../../lib/constants";

export function Header() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">🔥</span>
            <span className="text-lg font-bold tracking-tight text-slate-100">Habit Tracker</span>
          </div>
          {token && (
            <nav className="flex items-center gap-1">
              <NavLink
                to={ROUTES.HOME}
                end
                className={({ isActive }) =>
                  [
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-slate-800 text-slate-100"
                      : "text-slate-500 hover:text-slate-300",
                  ].join(" ")
                }
              >
                Habits
              </NavLink>
              <NavLink
                to={ROUTES.ANALYTICS}
                className={({ isActive }) =>
                  [
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-slate-800 text-slate-100"
                      : "text-slate-500 hover:text-slate-300",
                  ].join(" ")
                }
              >
                Analytics
              </NavLink>
              <NavLink
                to={ROUTES.TODOS}
                className={({ isActive }) =>
                  [
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-slate-800 text-slate-100"
                      : "text-slate-500 hover:text-slate-300",
                  ].join(" ")
                }
              >
                Todos
              </NavLink>
            </nav>
          )}
        </div>
        {token && (
          <Button variant="ghost" size="sm" onClick={() => dispatch(logout())}>
            Sign out
          </Button>
        )}
      </div>
    </header>
  );
}
