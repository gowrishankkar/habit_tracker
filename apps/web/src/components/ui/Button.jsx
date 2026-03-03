import { Spinner } from "./Spinner";

const variantClasses = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 " +
    "focus-visible:ring-blue-500 disabled:bg-blue-800 disabled:text-blue-300",
  secondary:
    "bg-slate-700 text-slate-100 hover:bg-slate-600 active:bg-slate-800 " +
    "focus-visible:ring-slate-500 disabled:bg-slate-800 disabled:text-slate-500",
  ghost:
    "bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white " +
    "focus-visible:ring-slate-500 disabled:text-slate-600",
  danger:
    "bg-red-700 text-white hover:bg-red-600 active:bg-red-800 " +
    "focus-visible:ring-red-500 disabled:bg-red-900 disabled:text-red-400",
};

const sizeClasses = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  loadingText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  children,
  className = "",
  ...props
}) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      disabled={isDisabled}
      aria-busy={isLoading}
      className={[
        "inline-flex items-center justify-center rounded-lg font-medium",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        "disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner size="sm" />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        <>
          {leftIcon}
          <span>{children}</span>
          {rightIcon}
        </>
      )}
    </button>
  );
}
