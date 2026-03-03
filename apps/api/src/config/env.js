import "dotenv/config";
import { z } from "zod";

/**
 * All environment variables are validated at process startup.
 * The app crashes immediately with a clear message rather than at
 * the first request that happens to use the missing variable.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),

  // Access tokens — short-lived (15 min default)
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),

  // Refresh tokens — long-lived (7 days default), separate secret so a
  // compromised access-token secret cannot be used to forge refresh tokens.
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export const env = envSchema.parse(process.env);
