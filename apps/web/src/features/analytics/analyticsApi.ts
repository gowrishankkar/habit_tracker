import { apiSlice } from "../auth/authApi";
import type {
  AnalyticsSummary,
  WeeklyDataPoint,
  MonthlyDataPoint,
  HeatmapDay,
  StreakEntry,
  CategorySlice,
} from "../../lib/types";

export const analyticsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAnalyticsSummary: builder.query<AnalyticsSummary, void>({
      query: () => "/analytics/summary",
      transformResponse: (res: { data: AnalyticsSummary }) => res.data,
      providesTags: [{ type: "Analytics" as const, id: "SUMMARY" }],
    }),
    getWeeklyCompletion: builder.query<WeeklyDataPoint[], void>({
      query: () => "/analytics/weekly",
      transformResponse: (res: { data: WeeklyDataPoint[] }) => res.data,
      providesTags: [{ type: "Analytics" as const, id: "WEEKLY" }],
    }),
    getMonthlyTrend: builder.query<MonthlyDataPoint[], number>({
      query: (days = 90) => "/analytics/monthly?days=" + days,
      transformResponse: (res: { data: MonthlyDataPoint[] }) => res.data,
      providesTags: (_r, _e, days) => [{ type: "Analytics" as const, id: "MONTHLY_" + days }],
    }),
    getHeatmap: builder.query<HeatmapDay[], void>({
      query: () => "/analytics/heatmap",
      transformResponse: (res: { data: HeatmapDay[] }) => res.data,
      providesTags: [{ type: "Analytics" as const, id: "HEATMAP" }],
    }),
    getStreakLeaderboard: builder.query<StreakEntry[], void>({
      query: () => "/analytics/streaks",
      transformResponse: (res: { data: StreakEntry[] }) => res.data,
      providesTags: [{ type: "Analytics" as const, id: "STREAKS" }],
    }),
    getCategoryDistribution: builder.query<CategorySlice[], void>({
      query: () => "/analytics/categories",
      transformResponse: (res: { data: CategorySlice[] }) => res.data,
      providesTags: [{ type: "Analytics" as const, id: "CATEGORIES" }],
    }),
  }),
});

export const {
  useGetAnalyticsSummaryQuery,
  useGetWeeklyCompletionQuery,
  useGetMonthlyTrendQuery,
  useGetHeatmapQuery,
  useGetStreakLeaderboardQuery,
  useGetCategoryDistributionQuery,
} = analyticsApi;
