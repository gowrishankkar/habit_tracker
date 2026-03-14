import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

function resolveApiBaseUrl(raw) {
  const value = (raw ?? "").trim();
  if (!value) return "/api";

  const normalized = value.replace(/\/+$/, "");
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
}

const BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL);

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: BASE_URL,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem("token");
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ["Habits", "Analytics"],
  endpoints: () => ({}),
});

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
    }),
    register: builder.mutation({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
    }),
    refreshTokens: builder.mutation({
      query: (body) => ({ url: "/auth/refresh", method: "POST", body }),
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation, useRefreshTokensMutation } =
  authApi;
