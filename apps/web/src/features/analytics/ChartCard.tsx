import React from "react";
import { Spinner } from "../../components/ui/Spinner";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  isError?: boolean;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  isLoading = false,
  isError = false,
  children,
  actions,
}: ChartCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="md" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="flex h-48 items-center justify-center text-sm text-red-400">
          Failed to load data
        </div>
      )}

      {!isLoading && !isError && children}
    </div>
  );
}
