import type { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";
import * as userService from "./user.service.js";

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await userService.getUserById(req.userId!);
  if (!user) {
    sendError(res, "User not found", 404);
    return;
  }
  sendSuccess(res, user);
}
