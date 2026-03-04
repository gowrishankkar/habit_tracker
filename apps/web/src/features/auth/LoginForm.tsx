/**
 * LoginForm
 * ─────────
 * React Hook Form + Zod-validated login form.
 *
 * Responsibilities:
 *  - Validate email format and minimum password length client-side.
 *  - Call the `login` action from AuthContext on submit.
 *  - Surface field-level errors from react-hook-form.
 *  - Surface server-side error messages in an Alert banner.
 *  - Show loading state on the submit button while the request is in flight.
 *  - Redirect to home on success (handled by the parent LoginPage).
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { useAuth } from "../../app/useAuth";
import type { LoginInput } from "../../lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Validation schema
// ─────────────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface LoginFormProps {
  /** Called by the parent page after a successful login. */
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      await login(values as LoginInput);
      onSuccess();
    } catch (err: unknown) {
      // Axios wraps the server JSON in err.response.data
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Something went wrong. Please try again.";
      setServerError(message);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-5"
      aria-label="Sign-in form"
    >
      {/* Server error banner */}
      {serverError && (
        <Alert variant="error" onDismiss={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      {/* Email */}
      <Input
        label="Email address"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register("email")}
      />

      {/* Password */}
      <Input
        label="Password"
        type={showPassword ? "text" : "password"}
        placeholder="••••••••"
        autoComplete="current-password"
        required
        error={errors.password?.message}
        rightAddon={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        }
        {...register("password")}
      />

      {/* Forgot password link */}
      <div className="flex justify-end">
        <button
          type="button"
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Forgot password?
        </button>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        fullWidth
        size="lg"
        isLoading={isSubmitting}
        loadingText="Signing in…"
      >
        Sign in
      </Button>
    </form>
  );
}
