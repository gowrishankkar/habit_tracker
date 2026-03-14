/**
 * Axios Instance with Auth Interceptors
 * ──────────────────────────────────────
 * Provides a configured axios instance used for all API calls.
 *
 * Request interceptor:  attaches the Bearer token from tokenStore.
 *
 * Response interceptor: on 401, attempts a silent token refresh.
 *   - If a refresh is already in flight, queues the failed request.
 *   - On successful refresh: retries ALL queued requests with the new token.
 *   - On failed refresh: rejects all queued requests, clears tokens,
 *     and fires a global "auth:logout" event for React to react to.
 *
 * The queue pattern prevents multiple simultaneous refresh calls when
 * several API requests fail with 401 at the same time (e.g. dashboard load).
 */

import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from "axios";
import { tokenStore } from "./tokenStore";
import type { ApiSuccess, Tokens } from "./types";

function resolveApiBaseUrl(raw?: string): string {
  const value = (raw ?? "").trim();
  if (!value) return "/api";

  const normalized = value.replace(/\/+$/, "");
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
}

const BASE_URL = resolveApiBaseUrl(
  (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_API_URL,
);

// ─────────────────────────────────────────────────────────────────────────────
// Instance
// ─────────────────────────────────────────────────────────────────────────────

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// ─────────────────────────────────────────────────────────────────────────────
// Request interceptor — attach Authorization header
// ─────────────────────────────────────────────────────────────────────────────

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStore.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─────────────────────────────────────────────────────────────────────────────
// Response interceptor — silent token refresh on 401
// ─────────────────────────────────────────────────────────────────────────────

interface QueueItem {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

let isRefreshing = false;
let failedQueue: QueueItem[] = [];

/** Drain the queue, resolving or rejecting each pending request. */
function processQueue(error: unknown, newToken: string | null = null): void {
  for (const item of failedQueue) {
    if (error) item.reject(error);
    else item.resolve(newToken!);
  }
  failedQueue = [];
}

/** URLs that must never trigger a refresh loop. */
const AUTH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"];

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,

  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const status = error.response?.status;
    const url = originalRequest?.url ?? "";

    // Only intercept 401s on non-auth endpoints that haven't been retried
    if (
      status !== 401 ||
      originalRequest._retry ||
      AUTH_PATHS.some((p) => url.includes(p))
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // ── Another refresh already in flight — queue this request ──────────
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(originalRequest);
      });
    }

    // ── No refresh token stored — force logout immediately ───────────────
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) {
      tokenStore.clear();
      window.dispatchEvent(new Event("auth:logout"));
      return Promise.reject(error);
    }

    // ── Start refresh ────────────────────────────────────────────────────
    isRefreshing = true;

    try {
      // Use plain axios (not our instance) to avoid interceptor loops
      const { data } = await axios.post<ApiSuccess<{ tokens: Tokens }>>(
        `${BASE_URL}/auth/refresh`,
        { refreshToken },
      );

      const { tokens } = data.data;
      tokenStore.setTokens(tokens);
      processQueue(null, tokens.accessToken);

      originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      tokenStore.clear();
      window.dispatchEvent(new Event("auth:logout"));
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Typed helpers — extract data from the standard { success, data } envelope
// ─────────────────────────────────────────────────────────────────────────────

export async function apiGet<T>(url: string): Promise<T> {
  const res = await axiosInstance.get<ApiSuccess<T>>(url);
  return res.data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await axiosInstance.post<ApiSuccess<T>>(url, body);
  return res.data.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await axiosInstance.patch<ApiSuccess<T>>(url, body);
  return res.data.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await axiosInstance.delete<ApiSuccess<T>>(url);
  return res.data.data;
}
