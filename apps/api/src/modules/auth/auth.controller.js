import { sendSuccess } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as authService from "./auth.service.js";

/**
 * Auth Controller — HTTP layer only.
 *
 * Controllers parse the request, delegate to the service, and format
 * the response. No business logic lives here — that belongs in the service.
 * asyncHandler forwards any thrown AppError to the global errorHandler.
 */

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, result, 201);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, result);
});

export const refresh = asyncHandler(async (req, res) => {
  const tokens = await authService.refresh(req.body.refreshToken);
  sendSuccess(res, { tokens });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  sendSuccess(res, { message: "Logged out successfully" });
});
