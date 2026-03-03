import type { ReactNode } from "react";

type AlertVariant = "error" | "success" | "warning" | "info";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
  /** Called when the user dismisses the alert. If omitted, no X button shown. */
  onDismiss?: () => void;
}

const variantStyles: Record<AlertVariant, string> = {
  error: "bg-red-950/60 border-red-700 text-red-300",
  success: "bg-green-950/60 border-green-700 text-green-300",
  warning: "bg-amber-950/60 border-amber-700 text-amber-300",
  info: "bg-blue-950/60 border-blue-700 text-blue-300",
};

const variantIcons: Record<AlertVariant, string> = {
  error: "✕",
  success: "✓",
  warning: "⚠",
  info: "ℹ",
};

export function Alert({
  variant = "error",
  title,
  children,
  className = "",
  onDismiss,
}: AlertProps) {
  return (
    <div
      role="alert"
      className={[
        "flex gap-3 rounded-lg border px-4 py-3 text-sm",
        variantStyles[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Icon */}
      <span className="mt-0.5 shrink-0 font-bold" aria-hidden="true">
        {variantIcons[variant]}
      </span>

      {/* Content */}
      <div className="flex-1 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        <p>{children}</p>
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-auto shrink-0 opacity-60 transition-opacity hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}
