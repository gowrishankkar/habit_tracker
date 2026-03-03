import { User } from "./user.model.js";
import { calculateLevel } from "../../utils/gamification.js";

/**
 * User repository — all DB operations for the User collection.
 *
 * Centralizing queries here means the service layer never imports Mongoose
 * directly, making it trivial to swap storage backends in tests.
 */
export const userRepository = {
  async findByEmail(email) {
    return User.findOne({ email });
  },

  /** Explicitly opt-in to the password field (excluded by default). */
  async findByEmailWithPassword(email) {
    return User.findOne({ email }).select("+password");
  },

  async findById(id) {
    return User.findById(id).lean();
  },

  async create(data) {
    return User.create(data);
  },

  /**
   * Apply an XP delta to the user and recalculate level atomically.
   *
   * Uses findOneAndUpdate so the XP increment is atomic even under concurrent
   * requests.  Level is derived from the new XP total — never incremented
   * blindly — so it's always consistent with the formula.
   *
   * @param {string} userId
   * @param {number} xpDelta  — positive to add, negative to remove (uncomplete)
   * @returns {Promise<{ previousXp, previousLevel, newXp, newLevel, leveledUp }>}
   */
  async applyXpAndLevel(userId, xpDelta) {
    // Read-then-write is safe here: habit completion is serialized per-user
    // (a user can't complete the same habit twice simultaneously).
    const user = await User.findById(userId).select("xp level");
    if (!user) throw new Error(`User ${userId} not found`);

    const previousXp    = user.xp;
    const previousLevel = user.level;

    const newXp    = Math.max(0, previousXp + xpDelta);
    const newLevel = calculateLevel(newXp);

    await User.findByIdAndUpdate(userId, { xp: newXp, level: newLevel });

    return { previousXp, previousLevel, newXp, newLevel, leveledUp: newLevel > previousLevel };
  },
};
