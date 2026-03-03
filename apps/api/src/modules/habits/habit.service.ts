import { Habit } from "./habit.model.js";
import type { CreateHabitDto, UpdateHabitDto } from "@habit-tracker/shared";

export async function list(userId: string) {
  return Habit.find({ userId }).sort({ createdAt: -1 }).lean();
}

export async function create(userId: string, dto: CreateHabitDto) {
  return Habit.create({ ...dto, userId });
}

export async function update(
  habitId: string,
  userId: string,
  dto: UpdateHabitDto,
) {
  return Habit.findOneAndUpdate({ _id: habitId, userId }, dto, {
    new: true,
    runValidators: true,
  }).lean();
}

export async function remove(habitId: string, userId: string) {
  return Habit.findOneAndDelete({ _id: habitId, userId });
}

export async function toggleCompletion(
  habitId: string,
  userId: string,
  dateStr: string,
) {
  const habit = await Habit.findOne({ _id: habitId, userId });
  if (!habit) return null;

  const target = new Date(dateStr);
  const idx = habit.completions.findIndex(
    (d) => d.toISOString().slice(0, 10) === target.toISOString().slice(0, 10),
  );

  if (idx === -1) {
    habit.completions.push(target);
  } else {
    habit.completions.splice(idx, 1);
  }

  await habit.save();
  return habit.toObject();
}
