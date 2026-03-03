import type { Response } from "express";
import type { ApiResponse } from "@habit-tracker/shared";

export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
): Response {
  const body: ApiResponse<T> = { success: true, data };
  return res.status(status).json(body);
}

export function sendError(
  res: Response,
  message: string,
  status = 400,
  errors?: string[],
): Response {
  const body: ApiResponse = { success: false, message, errors };
  return res.status(status).json(body);
}
