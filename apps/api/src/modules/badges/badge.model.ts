/**
 * Badge — static reference collection.
 *
 * Documents in this collection are created once by a seed script and are
 * read-heavy / write-almost-never. They are referenced from User.badges[].
 * Embedding the full badge definition inside each user document was
 * rejected because badge metadata (icon, description) changes over time
 * and an update would have required a fan-out write to every user row.
 */
import mongoose, { type Document } from "mongoose";
import type { BadgeTier, BadgeCriteriaType, HabitCategory } from "@habit-tracker/shared";

export interface IBadgeCriteria {
  type: BadgeCriteriaType;
  threshold: number;
  // Only set when type === "category_master"
  category?: HabitCategory;
}

export interface IBadge extends Document {
  name: string;
  description: string;
  icon: string;         // icon identifier / URL path
  criteria: IBadgeCriteria;
  xpReward: number;
  tier: BadgeTier;
}

const badgeCriteriaSchema = new mongoose.Schema<IBadgeCriteria>(
  {
    type: {
      type: String,
      enum: ["streak", "total_completions", "level", "category_master"],
      required: true,
    },
    threshold: { type: Number, required: true, min: 1 },
    category: { type: String },
  },
  { _id: false },
);

const badgeSchema = new mongoose.Schema<IBadge>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true, trim: true },
    icon: { type: String, required: true, trim: true },
    criteria: { type: badgeCriteriaSchema, required: true },
    xpReward: { type: Number, required: true, min: 0 },
    tier: {
      type: String,
      enum: ["bronze", "silver", "gold", "platinum"],
      required: true,
    },
  },
  { timestamps: true },
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Award-check queries: "find all badges of type X where threshold <= N"
// Run after each completion to determine if a new badge was earned.
badgeSchema.index({ "criteria.type": 1, "criteria.threshold": 1 });

export const Badge = mongoose.model<IBadge>("Badge", badgeSchema);
