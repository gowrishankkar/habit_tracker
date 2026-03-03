import { Habit } from "./habit.model.js";
import type { CreateHabitDto, UpdateHabitDto } from "@habit-tracker/shared";

export const habitRepository = {
  async findByUser(userId: string) {
    return Habit.find({ userId }).sort({ createdAt: -1 }).lean();
  },

  async create(userId: string, dto: CreateHabitDto) {
    return Habit.create({ ...dto, userId });
  },

  async update(habitId: string, userId: string, dto: UpdateHabitDto) {
    return Habit.findOneAndUpdate({ _id: habitId, userId }, dto, {
      new: true,
      runValidators: true,
    }).lean();
  },

  async delete(habitId: string, userId: string) {
    return Habit.findOneAndDelete({ _id: habitId, userId });
  },

  async findOne(habitId: string, userId: string) {
    return Habit.findOne({ _id: habitId, userId });
  },
};
