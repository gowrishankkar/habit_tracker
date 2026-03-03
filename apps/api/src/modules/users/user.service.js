import { userRepository } from "./user.repository.js";

/**
 * User service — thin layer for user profile reads.
 * Auth-related user writes live in auth.service.js to keep concerns separate.
 */
export async function getUserById(id) {
  const user = await userRepository.findById(id);
  if (!user) return null;
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    xp: user.xp,
    level: user.level,
    badges: user.badges ?? [],
    subscriptionTier: user.subscriptionTier,
    timezone: user.timezone,
  };
}
