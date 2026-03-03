import { Habit } from "./habit.model.js";

/**
 * Habit repository — all raw DB operations for the Habit collection.
 * Services own business logic; repositories own query construction.
 */
export const habitRepository = {
  async findByUser(userId) {
    return Habit.find({ userId, archived: false }).sort({ createdAt: -1 }).lean();
  },

  async findOne(habitId, userId) {
    // Returns a Mongoose document (not lean) so callers can call .save()
    return Habit.findOne({ _id: habitId, userId });
  },

  async create(userId, dto) {
    return Habit.create({ ...dto, userId });
  },

  async update(habitId, userId, dto) {
    return Habit.findOneAndUpdate({ _id: habitId, userId }, dto, {
      new: true,
      runValidators: true,
    }).lean();
  },

  async delete(habitId, userId) {
    return Habit.findOneAndDelete({ _id: habitId, userId });
  },
};
