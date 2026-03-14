import { Todo } from "./todo.model.js";

export const todoRepository = {
  async findByUser(userId) {
    return Todo.find({ userId }).sort({ completed: 1, createdAt: -1 }).lean();
  },

  async findOne(todoId, userId) {
    return Todo.findOne({ _id: todoId, userId });
  },

  async create(userId, dto) {
    return Todo.create({ ...dto, userId });
  },

  async update(todoId, userId, dto) {
    return Todo.findOneAndUpdate({ _id: todoId, userId }, dto, {
      new: true,
      runValidators: true,
    }).lean();
  },

  async delete(todoId, userId) {
    return Todo.findOneAndDelete({ _id: todoId, userId }).lean();
  },

  async clearCompleted(userId) {
    return Todo.deleteMany({ userId, completed: true });
  },
};
