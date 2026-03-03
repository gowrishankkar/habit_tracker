import mongoose, { type Document } from "mongoose";
import bcrypt from "bcryptjs";
import type { SubscriptionTier } from "@habit-tracker/shared";

export interface IUserBadge {
  badgeId: mongoose.Types.ObjectId;
  earnedAt: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  xp: number;
  level: number;
  badges: IUserBadge[];
  subscriptionTier: SubscriptionTier;
  timezone: string;
  comparePassword(candidate: string): Promise<boolean>;
}

const userBadgeSchema = new mongoose.Schema<IUserBadge>(
  {
    badgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Badge",
      required: true,
    },
    earnedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 8, select: false },
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    badges: { type: [userBadgeSchema], default: [] },
    subscriptionTier: {
      type: String,
      enum: ["free", "premium", "enterprise"],
      default: "free",
    },
    timezone: { type: String, default: "UTC", trim: true },
  },
  { timestamps: true },
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// email is already indexed via unique: true
// Leaderboard: sort by level desc, then xp desc as tiebreaker
userSchema.index({ level: -1, xp: -1 });

// ── Hooks ────────────────────────────────────────────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model<IUser>("User", userSchema);
