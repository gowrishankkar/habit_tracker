import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Layout } from "./components/layout/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import HabitList from "./features/habits/HabitList";
import { Spinner } from "./components/ui/Spinner";
import { OfflineBanner } from "./components/ui/OfflineBanner";
import { ROUTES } from "./lib/constants";

const AnalyticsDashboard = lazy(
  () => import("./features/analytics/AnalyticsDashboard"),
);

export default function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        <Route element={<Layout />}>
          <Route
            path={ROUTES.HOME}
            element={
              <ProtectedRoute>
                <HabitList />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.ANALYTICS}
            element={
              <ProtectedRoute>
                <Suspense
                  fallback={
                    <div className="flex h-64 items-center justify-center">
                      <Spinner size="lg" />
                    </div>
                  }
                >
                  <AnalyticsDashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
