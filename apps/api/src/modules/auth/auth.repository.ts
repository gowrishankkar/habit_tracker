import { RefreshToken } from "./refreshToken.model.js";

export const authRepository = {
  async saveRefreshToken(userId: string, token: string, expiresAt: Date) {
    return RefreshToken.create({ userId, token, expiresAt });
  },

  async findRefreshToken(token: string) {
    return RefreshToken.findOne({ token, revoked: false });
  },

  async revokeRefreshToken(token: string) {
    return RefreshToken.findOneAndUpdate({ token }, { revoked: true });
  },

  async revokeAllUserTokens(userId: string) {
    return RefreshToken.updateMany({ userId, revoked: false }, { revoked: true });
  },
};
