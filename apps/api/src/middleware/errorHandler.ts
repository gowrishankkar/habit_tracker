import type { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // AppError — expected operational errors with a proper status code
  if (err instanceof AppError) {
    if (!err.isOperational) {
      console.error("[error] Non-operational:", err.stack);
    }
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  // Mongoose duplicate key error
  if ((err as Record<string, unknown>).code === 11000) {
    sendError(res, "Duplicate value — resource already exists", 409);
    return;
  }

  // Everything else is unexpected — log full stack, hide details in prod
  console.error("[error]", err.stack ?? err.message);

  const message =
    env.NODE_ENV === "production" ? "Internal server error" : err.message;

  sendError(res, message, 500);
}
