import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { userRepository } from "../users/user.repository.js";
import { authRepository } from "./auth.repository.js";
import type {
  AuthResponse,
  AuthTokens,
  RegisterDto,
  LoginDto,
} from "@habit-tracker/shared";

// ── Token helpers ────────────────────────────────────

function signAccessToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

function parseExpiry(expiresIn: string): Date {
  const match = expiresIn.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // fallback 7d

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() + value * multipliers[unit]);
}

async function generateTokens(userId: string): Promise<AuthTokens> {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);

  // Persist refresh token in DB so it can be revoked
  const expiresAt = parseExpiry(env.JWT_REFRESH_EXPIRES_IN);
  await authRepository.saveRefreshToken(userId, refreshToken, expiresAt);

  return { accessToken, refreshToken };
}

// ── Public API ───────────────────────────────────────

export async function register(dto: RegisterDto): Promise<AuthResponse> {
  const exists = await userRepository.findByEmail(dto.email);
  if (exists) {
    throw AppError.conflict("Email already in use");
  }

  const user = await userRepository.create(dto);
  const tokens = await generateTokens(String(user._id));

  return {
    tokens,
    user: { _id: String(user._id), name: user.name, email: user.email },
  };
}

export async function login(dto: LoginDto): Promise<AuthResponse> {
  const user = await userRepository.findByEmailWithPassword(dto.email);
  if (!user) {
    throw AppError.unauthorized("Invalid credentials");
  }

  const valid = await user.comparePassword(dto.password);
  if (!valid) {
    throw AppError.unauthorized("Invalid credentials");
  }

  const tokens = await generateTokens(String(user._id));

  return {
    tokens,
    user: { _id: String(user._id), name: user.name, email: user.email },
  };
}

export async function refresh(oldRefreshToken: string): Promise<AuthTokens> {
  // 1. Verify the JWT signature and expiry
  let payload: { userId: string };
  try {
    payload = jwt.verify(
      oldRefreshToken,
      env.JWT_REFRESH_SECRET,
    ) as { userId: string };
  } catch {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  // 2. Check it exists in DB and hasn't been revoked
  const stored = await authRepository.findRefreshToken(oldRefreshToken);
  if (!stored) {
    // Token was revoked or reused — possible theft.
    // Revoke ALL tokens for this user as a precaution (rotation guard).
    await authRepository.revokeAllUserTokens(payload.userId);
    throw AppError.unauthorized(
      "Refresh token revoked — all sessions invalidated",
    );
  }

  // 3. Rotate: revoke the old token and issue a fresh pair
  await authRepository.revokeRefreshToken(oldRefreshToken);
  return generateTokens(payload.userId);
}

export async function logout(refreshToken: string): Promise<void> {
  await authRepository.revokeRefreshToken(refreshToken);
}
