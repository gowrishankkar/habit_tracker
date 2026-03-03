/**
 * Badge seed — run once to populate the Badge collection.
 *
 * Usage:
 *   node apps/api/src/modules/badges/badge.seed.js
 *
 * Safe to re-run: uses `upsert` on the unique `name` field, so existing
 * badges are updated rather than duplicated.
 */

import mongoose from "mongoose";
import { Badge } from "./badge.model.js";

const BADGES = [
  // ── First steps ───────────────────────────────────────────────────────────
  {
    name: "First Step",
    description: "Complete a habit for the first time.",
    unlockMessage: "You did it! Every journey starts with a single step.",
    icon: "🌱",
    tier: "bronze",
    xpReward: 25,
    criteria: [{ type: "total_completions", threshold: 1 }],
    order: 1,
  },
  {
    name: "Week Warrior",
    description: "Complete a habit 7 times.",
    unlockMessage: "7 completions! You're building momentum.",
    icon: "⚔️",
    tier: "bronze",
    xpReward: 50,
    criteria: [{ type: "total_completions", threshold: 7 }],
    order: 2,
  },
  {
    name: "Monthly Achiever",
    description: "Complete a habit 30 times.",
    unlockMessage: "30 completions — that's real commitment!",
    icon: "🏅",
    tier: "silver",
    xpReward: 150,
    criteria: [{ type: "total_completions", threshold: 30 }],
    order: 3,
  },
  {
    name: "Century Club",
    description: "Complete a habit 100 times.",
    unlockMessage: "100 completions! You're in rare company.",
    icon: "💯",
    tier: "gold",
    xpReward: 500,
    criteria: [{ type: "total_completions", threshold: 100 }],
    order: 4,
  },
  {
    name: "Year-Round Champion",
    description: "Complete a habit 365 times.",
    unlockMessage: "365 completions — an entire year of dedication!",
    icon: "🏆",
    tier: "platinum",
    xpReward: 2000,
    criteria: [{ type: "total_completions", threshold: 365 }],
    order: 5,
  },

  // ── Streak badges ─────────────────────────────────────────────────────────
  {
    name: "Hat Trick",
    description: "Maintain a 3-day streak.",
    unlockMessage: "3 days in a row! The streak has begun.",
    icon: "🎩",
    tier: "bronze",
    xpReward: 30,
    criteria: [{ type: "streak", threshold: 3 }],
    order: 10,
  },
  {
    name: "Full Week",
    description: "Maintain a 7-day streak.",
    unlockMessage: "A full week! Your consistency is paying off.",
    icon: "🔥",
    tier: "bronze",
    xpReward: 75,
    criteria: [{ type: "streak", threshold: 7 }],
    order: 11,
  },
  {
    name: "Fortnight Fire",
    description: "Maintain a 14-day streak.",
    unlockMessage: "Two weeks straight — the habit is becoming automatic.",
    icon: "🌟",
    tier: "silver",
    xpReward: 200,
    criteria: [{ type: "streak", threshold: 14 }],
    order: 12,
  },
  {
    name: "Month of Mastery",
    description: "Maintain a 30-day streak.",
    unlockMessage: "30 days! Research says habits lock in at 21 — you've crushed it.",
    icon: "🌙",
    tier: "silver",
    xpReward: 400,
    criteria: [{ type: "streak", threshold: 30 }],
    order: 13,
  },
  {
    name: "Iron Will",
    description: "Maintain a 100-day streak.",
    unlockMessage: "100 days without breaking the chain. Extraordinary.",
    icon: "⚡",
    tier: "gold",
    xpReward: 1000,
    criteria: [{ type: "streak", threshold: 100 }],
    order: 14,
  },
  {
    name: "Unbreakable",
    description: "Maintain a 365-day streak.",
    unlockMessage: "A full year. You are the habit.",
    icon: "💎",
    tier: "platinum",
    xpReward: 5000,
    criteria: [{ type: "streak", threshold: 365 }],
    order: 15,
  },

  // ── Level badges ──────────────────────────────────────────────────────────
  {
    name: "Level Up!",
    description: "Reach level 5.",
    unlockMessage: "Level 5 — you're on your way!",
    icon: "⬆️",
    tier: "bronze",
    xpReward: 50,
    criteria: [{ type: "level", threshold: 5 }],
    order: 20,
  },
  {
    name: "Double Digits",
    description: "Reach level 10.",
    unlockMessage: "Level 10! You've entered the top tier of habit builders.",
    icon: "🔟",
    tier: "silver",
    xpReward: 200,
    criteria: [{ type: "level", threshold: 10 }],
    order: 21,
  },
  {
    name: "Elite",
    description: "Reach level 25.",
    unlockMessage: "Level 25 — elite status achieved.",
    icon: "👑",
    tier: "gold",
    xpReward: 750,
    criteria: [{ type: "level", threshold: 25 }],
    order: 22,
  },

  // ── XP milestones ─────────────────────────────────────────────────────────
  {
    name: "XP Apprentice",
    description: "Earn 500 total XP.",
    unlockMessage: "500 XP! You're getting the hang of this.",
    icon: "✨",
    tier: "bronze",
    xpReward: 25,
    criteria: [{ type: "xp_milestone", threshold: 500 }],
    order: 30,
  },
  {
    name: "XP Veteran",
    description: "Earn 5,000 total XP.",
    unlockMessage: "5,000 XP — veteran habit tracker!",
    icon: "💫",
    tier: "silver",
    xpReward: 100,
    criteria: [{ type: "xp_milestone", threshold: 5000 }],
    order: 31,
  },

  // ── Category master badges ────────────────────────────────────────────────
  {
    name: "Health Hero",
    description: "Complete health habits 50 times.",
    unlockMessage: "50 health completions — your body thanks you!",
    icon: "❤️",
    tier: "silver",
    xpReward: 200,
    criteria: [{ type: "category_master", threshold: 50, category: "health" }],
    order: 40,
  },
  {
    name: "Fitness Fanatic",
    description: "Complete fitness habits 50 times.",
    unlockMessage: "50 fitness completions — you've earned those gains.",
    icon: "💪",
    tier: "silver",
    xpReward: 200,
    criteria: [{ type: "category_master", threshold: 50, category: "fitness" }],
    order: 41,
  },
  {
    name: "Mindfulness Master",
    description: "Complete mindfulness habits 30 times.",
    unlockMessage: "30 mindfulness sessions — true inner peace.",
    icon: "🧘",
    tier: "silver",
    xpReward: 200,
    criteria: [{ type: "category_master", threshold: 30, category: "mindfulness" }],
    order: 42,
  },

  // ── Consistency badges ────────────────────────────────────────────────────
  {
    name: "On a Roll",
    description: "Maintain an 80%+ 7-day completion rate.",
    unlockMessage: "80% completion rate — remarkably consistent.",
    icon: "📈",
    tier: "silver",
    xpReward: 150,
    criteria: [{ type: "consistency", threshold: 0.8 }],
    order: 50,
  },
  {
    name: "Perfectionist",
    description: "Maintain a 100% 7-day completion rate.",
    unlockMessage: "Perfect week! Not a single miss.",
    icon: "⭐",
    tier: "gold",
    xpReward: 300,
    criteria: [{ type: "consistency", threshold: 1.0 }],
    order: 51,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed runner
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  const mongoUri = process.env.MONGO_URI ?? "mongodb://localhost:27017/habit_tracker";
  await mongoose.connect(mongoUri);
  console.log("✅  Connected to MongoDB");

  let created = 0;
  let updated = 0;

  for (const badge of BADGES) {
    const result = await Badge.findOneAndUpdate(
      { name: badge.name },
      { $set: badge },
      { upsert: true, new: true },
    );
    if (result.createdAt?.getTime() === result.updatedAt?.getTime()) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(`✅  Seeded ${created} new badges, updated ${updated} existing`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
