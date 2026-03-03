/**
 * useOfflineStatus
 * ─────────────────
 * Tracks online/offline state and the count of pending Background Sync
 * operations. Used by OfflineBanner and the layout header.
 *
 * Two sync mechanisms are wired up:
 *  1. Background Sync API (Chrome/Edge): SW handles replay in the background
 *     even when the page is closed. We listen for SW postMessages to know
 *     when ops are drained.
 *  2. 'online' event fallback (Firefox/Safari): When the page detects the
 *     connection restored, replayFromPage() is called directly.
 */

import { useState, useEffect, useCallback } from "react";
import { getPendingCount, replayFromPage } from "./offlineQueue";

export interface OfflineStatus {
  /** True when navigator.onLine is true and at least one network request succeeded. */
  isOnline: boolean;
  /** Number of operations waiting to be synced. */
  pendingCount: number;
  /** True while a manual replay is in progress. */
  isSyncing: boolean;
  /** Manually trigger a sync attempt (for retry buttons). */
  retrySync: () => Promise<void>;
}

export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Refresh the badge count from IDB
  const refreshCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  // Manual / fallback replay triggered when 'online' fires
  const retrySync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await replayFromPage();
      await refreshCount();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshCount]);

  useEffect(() => {
    // Initial pending count
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      // Fallback replay for browsers without Background Sync API
      retrySync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshCount(); // update badge immediately
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen for SYNC_COMPLETE messages from the Service Worker.
    // The SW posts this after replaying ops via the Background Sync API.
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_COMPLETE") {
        refreshCount();
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleSwMessage);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handleSwMessage);
    };
  }, [refreshCount, retrySync]);

  return { isOnline, pendingCount, isSyncing, retrySync };
}
