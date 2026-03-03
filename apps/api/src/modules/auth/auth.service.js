import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { userRepository } from "../users/user.repository.js";
import { authRepository } from "./auth.repository.js";

/**
 * Auth Service — owns all authentication business logic.
 *
 * Token Architecture
 * ──────────────────
 * Access token  (JWT, short-lived 15 min):
 *   - Signed with JWT_SECRET
 *   - Sent in every API request via Authorization: Bearer <token>
 *   - NOT stored in the DB — stateless verification
 *
 * Refresh token (JWT, long-lived 7 days):
 *   - Signed with a DIFFERENT secret (JWT_REFRESH_SECRET) so a leaked
 *     access-token signing key cannot forge refresh tokens
 *   - Stored in the RefreshToken collection so it can be explicitly revoked
 *   - Rotation: each /auth/refresh call issues a new pair and revokes the old
 *     token, preventing replay attacks
 *
 * Theft Detection
 * ───────────────
 * If a refresh token that has already been revoked is presented, the server
 * assumes the original token was stolen. It revokes ALL active sessions for
 * that user, forcing a full re-login on every device.
 */

// ── Internal helpers ─────────────────────────────────────────────────────────

function signAccessToken(userId) {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

function signRefreshToken(userId) {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

/**
 * Converts an expiry string like "7d", "15m", "1h" to an absolute Date.
 * Used to set `expiresAt` on the RefreshToken document for the TTL index.
 */
function parseExpiry(expiresIn) {
  const match = expiresIn.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // fallback 7d

  const value = parseInt(match[1], 10);
  const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + value * multipliers[match[2]]);
}

/**
 * Issues a fresh access + refresh token pair and persists the refresh token.
 * Always called together so the two tokens are always in sync.
 */
async function generateTokenPair(userId) {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  const expiresAt = parseExpiry(env.JWT_REFRESH_EXPIRES_IN);

  await authRepository.saveRefreshToken(userId, refreshToken, expiresAt);

  return { accessToken, refreshToken };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a new user.
 * Returns the public user profile and a token pair on success.
 */
export async function register(dto) {
  const exists = await userRepository.findByEmail(dto.email);
  if (exists) {
    throw AppError.conflict("An account with this email already exists");
  }

  const user = await userRepository.create(dto);
  const tokens = await generateTokenPair(String(user._id));

  return {
    tokens,
    user: {
      _id: String(user._id),
      name: user.name,
      email: user.email,
      xp: user.xp,
      level: user.level,
      badges: user.badges,
      subscriptionTier: user.subscriptionTier,
      timezone: user.timezone,
    },
  };
}

/**
 * Authenticate an existing user with email + password.
 * Uses constant-time bcrypt comparison to prevent timing attacks.
 */
export async function login(dto) {
  // Fetch the user including the normally-hidden password field
  const user = await userRepository.findByEmailWithPassword(dto.email);
  if (!user) {
    // Use the same error message for missing user and wrong password
    // to prevent user-enumeration via error messages
    throw AppError.unauthorized("Invalid email or password");
  }

  const isValid = await user.comparePassword(dto.password);
  if (!isValid) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const tokens = await generateTokenPair(String(user._id));

  return {
    tokens,
    user: {
      _id: String(user._id),
      name: user.name,
      email: user.email,
      xp: user.xp,
      level: user.level,
      badges: user.badges,
      subscriptionTier: user.subscriptionTier,
      timezone: user.timezone,
    },
  };
}

/**
 * Rotate a refresh token — revoke the old one and issue a fresh pair.
 *
 * Steps:
 *   1. Verify JWT signature and expiry (fast, stateless)
 *   2. Check the token exists in DB and is not revoked (stateful)
 *   3. Revoke old token, issue new pair
 *
 * If a revoked token is presented: wipe ALL sessions for the user.
 */
export async function refresh(oldRefreshToken) {
  let payload;
  try {
    payload = jwt.verify(oldRefreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  const stored = await authRepository.findRefreshToken(oldRefreshToken);
  if (!stored) {
    // Token was already revoked — possible replay / theft scenario.
    // Revoke every session for this user as a precaution.
    await authRepository.revokeAllUserTokens(payload.userId);
    throw AppError.unauthorized(
      "Refresh token already used — all sessions invalidated for security",
    );
  }

  // Rotate: revoke the consumed token and mint a fresh pair
  await authRepository.revokeRefreshToken(oldRefreshToken);
  return generateTokenPair(payload.userId);
}

/**
 * Revoke the supplied refresh token (single-device logout).
 * Silent no-op if the token is not found — avoids leaking existence.
 */
export async function logout(refreshToken) {
  await authRepository.revokeRefreshToken(refreshToken);
}
