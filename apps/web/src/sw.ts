/// <reference lib="webworker" />
/**
 * Custom Service Worker — Habit Tracker PWA
 * ─────────────────────────────────────────
 * Strategy overview:
 *
 *  App Shell (JS/CSS/HTML)    → Precache + CacheFirst
 *    Content-hashed filenames mean each URL is unique per build. Aggressive
 *    caching is correct; stale versions can never sneak in on the same URL.
 *
 *  GET /api/habits            → NetworkFirst, 5s timeout, 5 min TTL
 *    Dashboard needs fresh data when online. Cached fallback lets users
 *    view (read-only) their habits while offline.
 *
 *  GET /api/users             → NetworkFirst, 5s timeout, 1 min TTL
 *    User profile (XP, level) should be reasonably current.
 *
 *  GET /api/analytics         → StaleWhileRevalidate, 10 min TTL
 *    Charts can tolerate slight staleness while fresh data loads in
 *    background. Avoids blocking the page on slower connections.
 *
 *  Static assets (fonts/img)  → CacheFirst, 30 day TTL
 *    URLs are immutable for a given resource — cache aggressively.
 *
 *  POST/PATCH/DELETE /api     → NetworkOnly + Background Sync queue
 *    Mutations must never be served from cache. When offline, the failed
 *    request is written to IndexedDB and replayed via the 'sync' event.
 *
 * Background Sync conflict resolution:
 *   TOGGLE  → 409 / 404 = idempotent success (discard op)
 *   CREATE  → 201 = success; tempId→serverId map sent to page via postMessage
 *   UPDATE  → 409/412 = server wins (last-write-wins, discard client changes)
 *   DELETE  → 404 = already gone (discard op)
 *   5xx     → leave in queue, Background Sync will retry
 */

import { clientsClaim } from "workbox-core";
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import {
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
} from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

// Background Sync API types — not yet in all TS webworker lib versions
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
  readonly lastChance: boolean;
}

declare function addEventListener(
  type: "sync",
  listener: (event: SyncEvent) => void
): void;

// ── Update flow ──────────────────────────────────────────────────────────────
// registerType: 'prompt' in vite.config means the app calls:
//   registration.waiting.postMessage({ type: 'SKIP_WAITING' })
// only when the user accepts the update banner. We never auto-skip-wait,
// which would break open tabs mid-session.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// Claim all existing clients on activation so the new SW takes effect
// immediately for tabs that were open during the update.
clientsClaim();

// ── Precache app shell ───────────────────────────────────────────────────────
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ── SPA navigation fallback ──────────────────────────────────────────────────
// Non-API navigations return precached index.html; React Router renders the
// route client-side. Without this, hard-refresh on /analytics returns 404.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/icons\//],
  })
);

// ── Runtime caching: Habits API ──────────────────────────────────────────────
registerRoute(
  ({ request, url }) =>
    request.method === "GET" && url.pathname.startsWith("/api/habits"),
  new NetworkFirst({
    cacheName: "habits-api-v1",
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 300 }),
    ],
  })
);

// ── Runtime caching: User profile ────────────────────────────────────────────
registerRoute(
  ({ request, url }) =>
    request.method === "GET" && url.pathname.startsWith("/api/users"),
  new NetworkFirst({
    cacheName: "users-api-v1",
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 60 }),
    ],
  })
);

// ── Runtime caching: Analytics (StaleWhileRevalidate) ───────────────────────
registerRoute(
  ({ request, url }) =>
    request.method === "GET" && url.pathname.startsWith("/api/analytics"),
  new StaleWhileRevalidate({
    cacheName: "analytics-api-v1",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 600 }),
    ],
  })
);

// ── Runtime caching: Static assets ──────────────────────────────────────────
registerRoute(
  ({ request }) =>
    request.destination === "font" || request.destination === "image",
  new CacheFirst({
    cacheName: "static-assets-v1",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

// ── Shared IDB schema (must stay in sync with src/lib/offlineQueue.ts) ───────
const OFFLINE_DB_NAME = "habit-tracker-offline";
const OFFLINE_DB_VERSION = 1;
const PENDING_STORE = "pending-ops";

interface PendingOp {
  id: string;
  type: "TOGGLE" | "CREATE" | "UPDATE" | "DELETE";
  url: string;
  method: string;
  body: unknown;
  timestamp: number;
  retries: number;
  authToken: string | null;
}

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        const store = db.createObjectStore(PENDING_STORE, { keyPath: "id" });
        store.createIndex("by_timestamp", "timestamp");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readAllPending(db: IDBDatabase): Promise<PendingOp[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readonly");
    const req = tx
      .objectStore(PENDING_STORE)
      .index("by_timestamp")
      .getAll();
    req.onsuccess = () => resolve(req.result as PendingOp[]);
    req.onerror = () => reject(req.error);
  });
}

function removePending(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readwrite");
    const req = tx.objectStore(PENDING_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Background Sync event ─────────────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "habit-sync") {
    event.waitUntil(replayPendingOps());
  }
});

// Also replay on SW activation for browsers without Background Sync API
self.addEventListener("activate", (event) => {
  event.waitUntil(replayPendingOps().catch(() => {}));
});

async function replayPendingOps(): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openOfflineDB();
  } catch {
    return; // IDB unavailable — nothing to do
  }

  const ops = await readAllPending(db);
  if (ops.length === 0) return;

  const results: Array<{ id: string; success: boolean; data?: unknown }> = [];

  for (const op of ops) {
    try {
      const response = await fetch(op.url, {
        method: op.method,
        headers: {
          "Content-Type": "application/json",
          ...(op.authToken
            ? { Authorization: `Bearer ${op.authToken}` }
            : {}),
        },
        body: op.body != null ? JSON.stringify(op.body) : undefined,
      });

      const discard = await resolveConflict(response, op);
      if (discard) {
        await removePending(db, op.id);
        const data = response.ok
          ? await response.clone().json().catch(() => null)
          : null;
        results.push({ id: op.id, success: response.ok, data });
      } else {
        // 5xx — keep in queue; Background Sync will retry
        results.push({ id: op.id, success: false });
      }
    } catch {
      // Network still unavailable — stop, let sync retry
      break;
    }
  }

  // Notify open tabs so they can invalidate their RTK Query cache
  const clientList = await self.clients.matchAll({ type: "window" });
  clientList.forEach((client) =>
    client.postMessage({ type: "SYNC_COMPLETE", results })
  );
}

/**
 * Returns true if the op should be removed from the queue (success or
 * unrecoverable client error), false if it should be kept for retry (5xx).
 */
async function resolveConflict(
  response: Response,
  _op: PendingOp
): Promise<boolean> {
  if (response.ok) return true; // 2xx — success

  // 404 — resource gone (habit deleted by another device): discard
  if (response.status === 404) return true;

  // 409 Conflict — toggle already applied / duplicate create: idempotent, discard
  if (response.status === 409) return true;

  // 412 Precondition Failed — server has newer version: server wins, discard
  if (response.status === 412) return true;

  // Other 4xx (400 Bad Request, 401 Unauthorized, 403 Forbidden): discard
  // to avoid retry-loops on invalid operations.
  if (response.status >= 400 && response.status < 500) return true;

  // 5xx — transient server error: keep in queue
  return false;
}

// Required by TypeScript for webworker lib
export {};
