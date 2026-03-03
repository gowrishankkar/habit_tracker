import React from "react";

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  /** Label shown to screen readers */
  label?: string;
  /** Show percentage text */
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function barColor(value: number): string {
  if (value >= 80) return "bg-green-500";
  if (value >= 50) return "bg-blue-500";
  if (value >= 25) return "bg-amber-500";
  return "bg-red-500";
}

export const ProgressBar = React.memo(function ProgressBar({
  value,
  label,
  showLabel = false,
  size = "sm",
  className = "",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  const heights: Record<NonNullable<ProgressBarProps["size"]>, string> = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>{label ?? "Progress"}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className={`w-full overflow-hidden rounded-full bg-slate-800 ${heights[size]}`}
      >
        <div
          className={`${heights[size]} rounded-full transition-all duration-500 ease-out ${barColor(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
});
