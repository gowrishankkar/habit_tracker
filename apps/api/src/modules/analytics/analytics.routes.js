import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as ctrl from "./analytics.controller.js";

const router = Router();

// All analytics routes require a valid access token
router.use(authenticate);

router.get("/summary",    ctrl.summaryStats);
router.get("/weekly",     ctrl.weeklyCompletion);
router.get("/monthly",    ctrl.monthlyTrend);      // ?days=30|60|90
router.get("/heatmap",    ctrl.heatmap);
router.get("/streaks",    ctrl.streakLeaderboard);
router.get("/categories", ctrl.categoryDistribution);

export default router;
