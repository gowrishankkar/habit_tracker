import { User } from "./user.model.js";
import type { UserPublic } from "@habit-tracker/shared";

export async function getUserById(id: string): Promise<UserPublic | null> {
  const user = await User.findById(id).lean();
  if (!user) return null;
  return { _id: String(user._id), name: user.name, email: user.email };
}
