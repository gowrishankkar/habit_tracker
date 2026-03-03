import mongoose, { type Document } from "mongoose";
import type {
  HabitFrequency,
  HabitDifficulty,
  HabitCategory,
} from "@habit-tracker/shared";

export interface IReminder {
  time: string;   // "HH:MM" in user's local timezone, e.g. "08:00"
  enabled: boolean;
}

export interface IHabit extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  // targetDays: day-of-week numbers (0=Sun…6=Sat) for weekly/custom;
  // empty array means every day for daily habits.
  targetDays: number[];
  reminders: IReminder[];
  // Denormalized streak counters — updated by the HabitLog service layer
  // on every completion/skip write. Avoids expensive aggregations on reads.
  streakCount: number;
  longestStreak: number;
  // Denormalized last-completion date — used by the streak-check cron and
  // the streak-recovery logic without touching habit_logs.
  lastCompletedAt?: Date;
  difficulty: HabitDifficulty;
  xpValue: number;
  color: string;
  archived: boolean;
  archivedAt?: Date;
}

const reminderSchema = new mongoose.Schema<IReminder>(
  {
    time: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const habitSchema = new mongoose.Schema<IHabit>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    category: {
      type: String,
      enum: [
        "health",
        "fitness",
        "mindfulness",
        "learning",
        "productivity",
        "social",
        "finance",
        "creativity",
        "other",
      ],
      default: "other",
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "custom"],
      default: "daily",
    },
    targetDays: { type: [Number], default: [] },
    reminders: { type: [reminderSchema], default: [] },
    streakCount: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    lastCompletedAt: { type: Date },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard", "expert"],
      default: "medium",
    },
    xpValue: { type: Number, default: 10, min: 1 },
    color: { type: String, default: "#3b82f6" },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  { timestamps: true },
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Primary dashboard query: "give me all active habits for this user"
// Covers the archived filter so MongoDB doesn't scan archived docs.
habitSchema.index({ userId: 1, archived: 1 });

// Category filter on the dashboard / analytics breakdown
habitSchema.index({ userId: 1, category: 1, archived: 1 });

// Streak-check cron & streak-recovery: find habits whose lastCompletedAt
// is stale so we can reset streakCount to 0.
// Also used when ordering habits by "most recently completed".
habitSchema.index({ userId: 1, lastCompletedAt: 1 });

// Reminder-scheduler query: fetch all non-archived habits with reminders
// grouped by frequency so the job can fan out efficiently.
habitSchema.index({ frequency: 1, archived: 1 });

export const Habit = mongoose.model<IHabit>("Habit", habitSchema);
