/**
 * Token Store
 * ───────────
 * Centralises all localStorage access for auth tokens.
 *
 * Why not keep tokens in Redux / React state only?
 * Redux state is lost on page refresh. localStorage persistence means
 * users stay logged in across browser sessions without re-entering creds.
 * The accessToken in Redux is the working copy; localStorage is the
 * cold-start seed used to rehydrate on next load.
 *
 * Why not httpOnly cookies?
 * The API is on a different origin during development (port 4000 vs 5173).
 * httpOnly cookies require same-site or CORS credentials config.
 * For a PWA that must work offline and across origins, localStorage +
 * Authorization header is the pragmatic choice. The refresh token receives
 * the same treatment — it is only ever sent to /auth/refresh, never to
 * other endpoints.
 */

const ACCESS_KEY = "token";
const REFRESH_KEY = "refreshToken";

export const tokenStore = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },

  setTokens(tokens: { accessToken: string; refreshToken: string }): void {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },

  /** Remove both tokens — used on logout and on unrecoverable 401. */
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },

  hasAccessToken(): boolean {
    return Boolean(localStorage.getItem(ACCESS_KEY));
  },
};
