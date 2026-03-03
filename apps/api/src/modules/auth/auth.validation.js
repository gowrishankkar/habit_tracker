import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@habit-tracker/shared";

/**
 * Zod schemas for auth endpoints.
 *
 * Defining schemas here (not inline in routes) means:
 *   - The same schema can be reused across routes or in tests
 *   - Business rules (min length, email format) live in one place
 *   - The validate() middleware strips extra fields (Zod strips by default)
 */

export const registerSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name must be 50 characters or less")
    .trim(),
  email: z.string().email("A valid email address is required").toLowerCase(),
  password: z.string().min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  ),
  timezone: z.string().optional().default("UTC"),
});

export const loginSchema = z.object({
  email: z.string().email("A valid email address is required").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});
