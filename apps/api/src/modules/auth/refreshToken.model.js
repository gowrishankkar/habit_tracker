import mongoose from "mongoose";

/**
 * RefreshToken — one document per issued refresh token.
 *
 * Storing refresh tokens in the database enables:
 *   - Revocation (logout invalidates the specific token immediately)
 *   - Rotation guard: if a revoked token is reused, all user sessions
 *     are wiped (theft detection)
 *   - Automatic expiry cleanup via MongoDB TTL index
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// MongoDB TTL index: the daemon automatically removes documents once
// expiresAt is in the past, keeping the collection lean without a cron job.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
