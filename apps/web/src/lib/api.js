function resolveApiBaseUrl(raw) {
  const value = (raw ?? "").trim();
  if (!value) return "/api";

  const normalized = value.replace(/\/+$/, "");
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
}

const BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL);

/**
 * Thin fetch wrapper — used for one-off requests outside RTK Query.
 * Automatically attaches the Authorization header and handles JSON parsing.
 */
async function request(endpoint, { body, headers, ...opts } = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...opts,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Request failed");
  return json.data;
}

export const api = {
  get: (url) => request(url, { method: "GET" }),
  post: (url, body) => request(url, { method: "POST", body }),
  patch: (url, body) => request(url, { method: "PATCH", body }),
  delete: (url) => request(url, { method: "DELETE" }),
};
