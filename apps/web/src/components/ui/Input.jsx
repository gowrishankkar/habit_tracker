import { forwardRef } from "react";

export const Input = forwardRef(function Input(
  { label, error, hint, id, leftAddon, rightAddon, className = "", ...props },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  const hasError = Boolean(error);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-300">
          {label}
          {props.required && (
            <span className="ml-0.5 text-red-400" aria-hidden="true">*</span>
          )}
        </label>
      )}

      <div className="relative">
        {leftAddon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            {leftAddon}
          </div>
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={hasError}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          className={[
            "w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-slate-100",
            "placeholder:text-slate-500 transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950",
            hasError
              ? "border-red-600 focus:ring-red-500"
              : "border-slate-700 focus:border-blue-500 focus:ring-blue-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            leftAddon ? "pl-9" : "",
            rightAddon ? "pr-9" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {rightAddon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
            {rightAddon}
          </div>
        )}
      </div>

      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-slate-500">{hint}</p>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="flex items-center gap-1 text-xs text-red-400">
          <span aria-hidden="true">✕</span>
          {error}
        </p>
      )}
    </div>
  );
});
