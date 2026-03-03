import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UserBadge — earned badge reference embedded in the user document.
 *
 * WHY EMBED here instead of a separate UserBadge collection?
 * ──────────────────────────────────────────────────────────
 * A user earns ≤ ~50 badges in a lifetime. The bounded size makes embedding
 * safe: no 16 MB cap risk, and the profile page reads everything in one query.
 * Badge *metadata* (icon, description) lives in the Badge collection so a
 * content update doesn't fan-out to every User document.
 */
const userBadgeSchema = new mongoose.Schema(
  {
    badgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Badge",
      required: true,
    },
    earnedAt: { type: Date, required: true, default: Date.now },
    // Store the XP reward at time of earning — Badge.xpReward may change later.
    xpSnapshot: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

/**
 * PushSubscription — Web Push API endpoint stored per device.
 *
 * WHY EMBED (up to 5) instead of a separate collection?
 * ──────────────────────────────────────────────────────
 * Most users have 1-3 devices. Embedding keeps "fetch user + send push" as a
 * single document read. A separate collection would be worth it only if a
 * user could register hundreds of devices (not the case here).
 */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// User schema
// ─────────────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    /**
     * Password: bcrypt hash, cost 12.
     * select: false → never included in query results unless `.select("+password")`
     * is explicitly called. Prevents accidental exposure in API responses.
     */
    password: { type: String, required: true, minlength: 8, select: false },

    // ── Gamification ─────────────────────────────────────────────────────────
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },

    /**
     * badges: embedded array of earned-badge references.
     * See tradeoff note in userBadgeSchema above.
     */
    badges: { type: [userBadgeSchema], default: [] },

    // ── Subscription ─────────────────────────────────────────────────────────
    subscriptionTier: {
      type: String,
      enum: ["free", "premium", "enterprise"],
      default: "free",
    },
    /**
     * subscriptionExpiresAt: null = lifetime / free.
     * Set for time-limited premium plans so a cron job can downgrade
     * expired subscriptions without a billing webhook.
     */
    subscriptionExpiresAt: { type: Date, default: null },

    // ── Locale / preferences ─────────────────────────────────────────────────
    /**
     * timezone: IANA tz string ("America/New_York", "Europe/London").
     * Critical for streak calculations — "yesterday" means different
     * UTC ranges for different users. Stored on User so we don't have
     * to parse it on every HabitLog write.
     */
    timezone: { type: String, default: "UTC", trim: true },
    weekStartsOn: {
      type: Number,
      enum: [0, 1], // 0 = Sunday, 1 = Monday
      default: 0,
    },

    // ── Push notifications ────────────────────────────────────────────────────
    /**
     * pushSubscriptions: Web Push API endpoints per device.
     * Capped at 5 to prevent unbounded growth.
     */
    pushSubscriptions: {
      type: [pushSubscriptionSchema],
      default: [],
      validate: {
        validator: (v) => v.length <= 5,
        message: "A user may register at most 5 push endpoints",
      },
    },

    // ── Activity signals (denormalized for fast dashboard queries) ────────────
    /**
     * lastActiveAt: updated on every API request via middleware.
     * Used for DAU/WAU analytics and "inactive user" re-engagement emails.
     * A separate UserActivity collection would be more precise but far more
     * expensive — this single field covers 90% of analytics needs.
     */
    lastActiveAt: { type: Date, default: null },

    /**
     * currentStreakDays: longest unbroken day-streak across ALL habits.
     * Denormalized here so the profile header can show it without aggregating
     * across habits. Updated by the streak-check cron.
     */
    currentStreakDays: { type: Number, default: 0, min: 0 },

    // ── Soft delete ───────────────────────────────────────────────────────────
    /**
     * deletedAt: null = active account.
     * GDPR "right to erasure" requests are handled by a background job that
     * overwrites PII fields and sets this date. Keeping the document lets us
     * maintain referential integrity in HabitLog for billing / audit trails.
     */
    deletedAt: { type: Date, default: null, select: false },
  },
  { timestamps: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Leaderboard query: sort users by level DESC, break ties with xp DESC.
 * Covered index — no document fetch needed for the ranking list.
 */
userSchema.index({ level: -1, xp: -1 });

/**
 * Subscription expiry cron: find users whose paid plan has lapsed.
 * Sparse because most documents have subscriptionExpiresAt = null.
 * Without sparse, every free-tier user wastes a slot in this index.
 */
userSchema.index(
  { subscriptionExpiresAt: 1 },
  {
    sparse: true,
    partialFilterExpression: { subscriptionExpiresAt: { $ne: null } },
  },
);

/**
 * Re-engagement campaign: find users inactive for > N days.
 * Partial index only covers active (non-deleted) accounts.
 */
userSchema.index(
  { lastActiveAt: 1 },
  { partialFilterExpression: { deletedAt: null } },
);

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hash password only when it has been modified.
 * Guards against double-hashing when unrelated fields (timezone, xp) are saved.
 */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Instance methods
// ─────────────────────────────────────────────────────────────────────────────

/** Constant-time bcrypt comparison — prevents timing attacks. */
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

/** Returns the public-safe projection (no password, no deletedAt). */
userSchema.methods.toPublic = function () {
  return {
    _id: String(this._id),
    name: this.name,
    email: this.email,
    xp: this.xp,
    level: this.level,
    badges: this.badges,
    subscriptionTier: this.subscriptionTier,
    timezone: this.timezone,
    weekStartsOn: this.weekStartsOn,
    currentStreakDays: this.currentStreakDays,
    lastActiveAt: this.lastActiveAt,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model("User", userSchema);
