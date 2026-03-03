/**
 * Offline Queue — IndexedDB-backed pending operation store
 * ─────────────────────────────────────────────────────────
 * Stores mutations that failed due to network unavailability.
 * The SW reads this same IDB store during a 'sync' event and replays
 * the operations when the connection is restored.
 *
 * DB schema must stay in sync with the constants in src/sw.ts.
 *
 * IndexedDB vs localStorage:
 *   - IDB is async (doesn't block the main thread)
 *   - IDB survives memory pressure that clears sessionStorage
 *   - IDB is accessible from both the page and the service worker
 *   - Structured data (objects) can be stored without JSON.stringify
 */

export interface PendingOp {
  id: string;
  /** Operation type — determines conflict resolution strategy on replay */
  type: "TOGGLE" | "CREATE" | "UPDATE" | "DELETE";
  url: string;
  method: string;
  body: unknown;
  /** Unix ms — ops are replayed in chronological order */
  timestamp: number;
  retries: number;
  /** Auth token captured at enqueue time so the SW can authenticate the replay */
  authToken: string | null;
}

// ── IDB constants (must match src/sw.ts) ─────────────────────────────────────
const DB_NAME = "habit-tracker-offline";
const DB_VERSION = 1;
const PENDING_STORE = "pending-ops";

// ── IDB lifecycle ─────────────────────────────────────────────────────────────
let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        const store = db.createObjectStore(PENDING_STORE, { keyPath: "id" });
        store.createIndex("by_timestamp", "timestamp");
      }
    };

    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

// ── Queue operations ──────────────────────────────────────────────────────────

/** Persist a failed mutation to the offline queue. */
export async function enqueueOperation(op: PendingOp): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readwrite");
    tx.objectStore(PENDING_STORE).put(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Remove a successfully replayed op from the queue. */
export async function dequeueOperation(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readwrite");
    tx.objectStore(PENDING_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Count of pending operations — used for the UI badge. */
export async function getPendingCount(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE, "readonly");
      const req = tx.objectStore(PENDING_STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

/** All pending ops sorted by timestamp (chronological replay order). */
export async function getAllPending(): Promise<PendingOp[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE, "readonly");
      const req = tx
        .objectStore(PENDING_STORE)
        .index("by_timestamp")
        .getAll();
      req.onsuccess = () => resolve(req.result as PendingOp[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Register a Background Sync tag so the SW can replay ops when
 * connectivity is restored — even if the page is closed.
 *
 * Falls back silently when the Background Sync API is unavailable
 * (e.g. Firefox, Safari). In that case, the online event handler in
 * useOfflineStatus.ts triggers a manual replay via the page.
 */
export async function registerBackgroundSync(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    // @ts-expect-error — sync API not in TS lib yet
    await reg.sync.register("habit-sync");
  } catch {
    // Background Sync not supported — page will handle replay via 'online' event
  }
}

/**
 * Manually replay all pending ops from the page (fallback for browsers
 * without Background Sync API, or when the page is already open).
 * Returns an array of IDs that were successfully synced.
 */
export async function replayFromPage(
  baseUrl = ""
): Promise<{ synced: string[]; failed: string[] }> {
  const ops = await getAllPending();
  const synced: string[] = [];
  const failed: string[] = [];

  for (const op of ops) {
    try {
      const res = await fetch(baseUrl + op.url, {
        method: op.method,
        headers: {
          "Content-Type": "application/json",
          ...(op.authToken
            ? { Authorization: `Bearer ${op.authToken}` }
            : {}),
        },
        body: op.body != null ? JSON.stringify(op.body) : undefined,
      });

      // Same conflict resolution as the SW:
      // 2xx, 404, 409, 412, other 4xx → remove from queue
      // 5xx → keep for retry
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        await dequeueOperation(op.id);
        synced.push(op.id);
      } else {
        failed.push(op.id);
      }
    } catch {
      failed.push(op.id);
      break; // network still down
    }
  }

  return { synced, failed };
}
