import { todoRepository } from "./todo.repository.js";

export async function list(userId) {
  return todoRepository.findByUser(userId);
}

export async function create(userId, dto) {
  const payload = {
    title: dto.title,
    completed: dto.completed ?? false,
    completedAt: dto.completed ? new Date() : null,
  };

  return todoRepository.create(userId, payload);
}

export async function update(todoId, userId, dto) {
  const payload = { ...dto };

  if (typeof payload.completed === "boolean") {
    payload.completedAt = payload.completed ? new Date() : null;
  }

  return todoRepository.update(todoId, userId, payload);
}

export async function toggle(todoId, userId) {
  const todo = await todoRepository.findOne(todoId, userId);
  if (!todo) return null;

  todo.completed = !todo.completed;
  todo.completedAt = todo.completed ? new Date() : null;
  await todo.save();

  return todo.toObject();
}

export async function remove(todoId, userId) {
  return todoRepository.delete(todoId, userId);
}

export async function clearCompleted(userId) {
  const result = await todoRepository.clearCompleted(userId);
  return { deletedCount: result.deletedCount ?? 0 };
}
