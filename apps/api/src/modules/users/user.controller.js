import { sendSuccess, sendError } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as userService from "./user.service.js";

export const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.userId);
  if (!user) {
    sendError(res, "User not found", 404);
    return;
  }
  sendSuccess(res, user);
});
