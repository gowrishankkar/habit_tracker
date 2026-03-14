import { sendSuccess, sendError } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as todoService from "./todo.service.js";

export const list = asyncHandler(async (req, res) => {
  const todos = await todoService.list(req.userId);
  sendSuccess(res, todos);
});

export const create = asyncHandler(async (req, res) => {
  const todo = await todoService.create(req.userId, req.body);
  sendSuccess(res, todo, 201);
});

export const update = asyncHandler(async (req, res) => {
  const todo = await todoService.update(req.params.id, req.userId, req.body);
  if (!todo) {
    sendError(res, "Todo not found", 404);
    return;
  }
  sendSuccess(res, todo);
});

export const toggle = asyncHandler(async (req, res) => {
  const todo = await todoService.toggle(req.params.id, req.userId);
  if (!todo) {
    sendError(res, "Todo not found", 404);
    return;
  }
  sendSuccess(res, todo);
});

export const remove = asyncHandler(async (req, res) => {
  const todo = await todoService.remove(req.params.id, req.userId);
  if (!todo) {
    sendError(res, "Todo not found", 404);
    return;
  }
  sendSuccess(res, { deleted: true });
});

export const clearCompleted = asyncHandler(async (req, res) => {
  const result = await todoService.clearCompleted(req.userId);
  sendSuccess(res, result);
});
