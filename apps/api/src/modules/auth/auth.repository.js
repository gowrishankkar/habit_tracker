import { RefreshToken } from "./refreshToken.model.js";

/**
 * Auth repository — all DB operations for refresh tokens.
 *
 * The repository pattern keeps raw Mongoose queries out of the service layer
 * so that storage details (indexes, collection names, query shape) can change
 * without touching business logic.
 */
export const authRepository = {
  /** Persist a newly issued refresh token. */
  async saveRefreshToken(userId, token, expiresAt) {
    return RefreshToken.create({ userId, token, expiresAt, revoked: false });
  },

  /** Find an active (non-revoked) refresh token document. */
  async findRefreshToken(token) {
    return RefreshToken.findOne({ token, revoked: false });
  },

  /** Soft-revoke a single token (used on normal logout / rotation). */
  async revokeRefreshToken(token) {
    return RefreshToken.findOneAndUpdate({ token }, { revoked: true });
  },

  /** Revoke ALL active tokens for a user — called on theft detection. */
  async revokeAllUserTokens(userId) {
    return RefreshToken.updateMany(
      { userId, revoked: false },
      { revoked: true },
    );
  },
};
