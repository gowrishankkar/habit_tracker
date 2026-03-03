/**
 * OfflineBanner
 * ─────────────
 * Sticky top strip that appears when the user is offline or has pending
 * Background Sync operations waiting to be replayed.
 *
 * Visibility logic:
 *   - offline + no pending ops  → "You're offline. Changes will sync when reconnected."
 *   - offline + pending ops     → "X changes pending sync"
 *   - online  + pending ops     → "Syncing N pending changes…" (isSyncing)
 *                               → "N changes pending" + Retry button (not syncing)
 *   - online  + no pending ops  → hidden
 */

import { useOfflineStatus } from "../../lib/useOfflineStatus";

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, retrySync } = useOfflineStatus();

  // Nothing to show when fully online and queue is empty
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        fixed top-0 inset-x-0 z-50
        flex items-center justify-center gap-3
        px-4 py-2 text-sm font-medium
        transition-colors duration-300
        ${
          isOnline
            ? "bg-amber-500/90 text-amber-950"
            : "bg-slate-700/95 text-slate-100"
        }
        backdrop-blur-sm
      `}
    >
      {/* Status icon */}
      {isOnline ? (
        isSyncing ? (
          <SpinnerIcon />
        ) : (
          <PendingIcon />
        )
      ) : (
        <OfflineIcon />
      )}

      {/* Message */}
      <span>
        {!isOnline && pendingCount === 0 &&
          "You're offline. New changes will sync when reconnected."}
        {!isOnline && pendingCount > 0 &&
          `Offline — ${pendingCount} change${pendingCount !== 1 ? "s" : ""} pending sync`}
        {isOnline && isSyncing &&
          `Syncing ${pendingCount} pending change${pendingCount !== 1 ? "s" : ""}…`}
        {isOnline && !isSyncing && pendingCount > 0 &&
          `${pendingCount} change${pendingCount !== 1 ? "s" : ""} waiting to sync`}
      </span>

      {/* Retry button — only shown when online but not yet syncing */}
      {isOnline && !isSyncing && pendingCount > 0 && (
        <button
          onClick={retrySync}
          className="
            ml-1 underline underline-offset-2
            hover:no-underline focus:outline-none
            focus:ring-2 focus:ring-amber-700 rounded
          "
        >
          Retry now
        </button>
      )}
    </div>
  );
}

function OfflineIcon() {
  return (
    <svg
      className="w-4 h-4 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M9 9a3.5 3.5 0 116 6M3 3l18 18"
      />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg
      className="w-4 h-4 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="w-4 h-4 flex-shrink-0 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
