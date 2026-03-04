import { sendSuccess } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as svc from "./analytics.service.js";

export const summaryStats = asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getSummaryStats(req.userId));
});

export const weeklyCompletion = asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getWeeklyCompletion(req.userId));
});

export const monthlyTrend = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days ?? "90", 10), 7), 365);
  sendSuccess(res, await svc.getMonthlyTrend(req.userId, days));
});

export const heatmap = asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getHeatmap(req.userId));
});

export const streakLeaderboard = asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getStreakLeaderboard(req.userId));
});

export const categoryDistribution = asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getCategoryDistribution(req.userId));
});
