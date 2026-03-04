/**
 * RegisterForm
 * ────────────
 * React Hook Form + Zod-validated registration form.
 *
 * Validation rules:
 *  - Name: 2–50 characters
 *  - Email: valid email format
 *  - Password: ≥8 chars, 1 uppercase, 1 digit (visual strength indicator)
 *  - Confirm password: must match password
 *
 * UX features:
 *  - Real-time password strength meter
 *  - Toggle password visibility
 *  - Field-level inline errors
 *  - Server error banner with dismiss
 *  - Loading state on submit button
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { useAuth } from "../../app/useAuth";
import type { RegisterInput } from "../../lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Validation schema
// ─────────────────────────────────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name must be 50 characters or less")
      .regex(/\S/, "Name cannot be blank"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Password strength meter
// ─────────────────────────────────────────────────────────────────────────────

interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

function getPasswordStrength(password: string): StrengthResult {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Cap at 4
  const capped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const levels: Record<1 | 2 | 3 | 4, { label: string; color: string }> = {
    1: { label: "Weak", color: "bg-red-500" },
    2: { label: "Fair", color: "bg-amber-500" },
    3: { label: "Good", color: "bg-yellow-400" },
    4: { label: "Strong", color: "bg-green-500" },
  };
  return capped === 0
    ? { score: 0, label: "", color: "" }
    : { score: capped, ...levels[capped] };
}

function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  if (!password) return null;

  return (
    <div className="space-y-1" aria-live="polite" aria-atomic="true">
      <div className="flex gap-1">
        {([1, 2, 3, 4] as const).map((level) => (
          <div
            key={level}
            className={[
              "h-1 flex-1 rounded-full transition-colors duration-300",
              strength.score >= level ? strength.color : "bg-slate-700",
            ].join(" ")}
          />
        ))}
      </div>
      {strength.label && (
        <p className="text-right text-xs text-slate-500">
          Strength:{" "}
          <span
            className={
              strength.score <= 1
                ? "text-red-400"
                : strength.score <= 2
                  ? "text-amber-400"
                  : strength.score <= 3
                    ? "text-yellow-400"
                    : "text-green-400"
            }
          >
            {strength.label}
          </span>
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface RegisterFormProps {
  /** Called by the parent page after a successful registration. */
  onSuccess: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { register: authRegister } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    mode: "onTouched", // validate on blur for better UX
  });

  const passwordValue = watch("password");

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError(null);
    try {
      const { confirmPassword: _, ...input } = values;
      await authRegister(input as RegisterInput);
      onSuccess();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; errors?: Record<string, string[]> } };
      };
      const data = axiosErr?.response?.data;

      // Surface first field error if the server returns field-level errors
      if (data?.errors) {
        const first = Object.values(data.errors)[0];
        setServerError(first?.[0] ?? "Registration failed.");
      } else {
        setServerError(data?.message ?? "Something went wrong. Please try again.");
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-5"
      aria-label="Registration form"
    >
      {/* Server error banner */}
      {serverError && (
        <Alert variant="error" onDismiss={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      {/* Name */}
      <Input
        label="Full name"
        type="text"
        placeholder="Jane Smith"
        autoComplete="name"
        required
        error={errors.name?.message}
        {...register("name")}
      />

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

      {/* Password + strength meter */}
      <div className="space-y-2">
        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          hint="Min 8 characters, 1 uppercase, 1 number"
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
        <PasswordStrengthMeter password={passwordValue} />
      </div>

      {/* Confirm password */}
      <Input
        label="Confirm password"
        type={showConfirm ? "text" : "password"}
        placeholder="••••••••"
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        rightAddon={
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            {showConfirm ? "Hide" : "Show"}
          </button>
        }
        {...register("confirmPassword")}
      />

      {/* Terms notice */}
      <p className="text-center text-xs text-slate-500">
        By creating an account you agree to our{" "}
        <button
          type="button"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
        >
          Terms of Service
        </button>
        .
      </p>

      {/* Submit */}
      <Button
        type="submit"
        fullWidth
        size="lg"
        isLoading={isSubmitting}
        loadingText="Creating account…"
      >
        Create account
      </Button>
    </form>
  );
}
