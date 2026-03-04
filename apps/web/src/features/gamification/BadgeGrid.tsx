/**
 * BadgeGrid
 * ─────────
 * Shows all badges in the catalog. Earned badges are coloured by tier.
 * Unearned badges are greyed out with a lock icon.
 *
 * Data comes from two RTK Query calls:
 *   • /analytics/badges (earned list from user profile) → useGetBadgesQuery
 *   • Badge catalog is derived from the earned list + any static metadata
 *
 * For now we render only earned badges (as the catalog is seeded server-side).
 * Unearned badges require a GET /badges catalog endpoint which is noted as a
 * future enhancement.
 */
import React from "react";
import type { BadgeEarned } from "../../lib/types";

const TIER_RING: Record<string, string> = {
  bronze:   "ring-amber-700/60  bg-amber-950/40",
  silver:   "ring-slate-500/60  bg-slate-800/60",
  gold:     "ring-yellow-500/60 bg-yellow-950/40",
  platinum: "ring-cyan-400/60   bg-cyan-950/40",
};

const TIER_LABEL: Record<string, string> = {
  bronze:   "text-amber-400",
  silver:   "text-slate-400",
  gold:     "text-yellow-400",
  platinum: "text-cyan-400",
};

interface BadgeCardProps {
  badge: BadgeEarned;
  earnedAt?: string;
}

function BadgeCard({ badge, earnedAt }: BadgeCardProps) {
  const ringClass = TIER_RING[badge.tier] ?? TIER_RING.bronze;
  const labelClass = TIER_LABEL[badge.tier] ?? TIER_LABEL.bronze;

  return (
    <div
      title={badge.unlockMessage ?? badge.description}
      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-transform hover:scale-105 ring-1 ${ringClass}`}
    >
      <span className="text-3xl leading-none" aria-hidden="true">{badge.icon}</span>
      <p className="text-xs font-semibold text-slate-200 leading-tight">{badge.name}</p>
      <p className={`text-[10px] font-medium capitalize ${labelClass}`}>{badge.tier}</p>
      {earnedAt && (
        <p className="text-[9px] text-slate-600">
          {new Date(earnedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </p>
      )}
    </div>
  );
}

interface BadgeGridProps {
  badges: (BadgeEarned & { earnedAt?: string })[];
  isLoading?: boolean;
}

export const BadgeGrid = React.memo(function BadgeGrid({
  badges,
  isLoading = false,
}: BadgeGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
        ))}
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-800 py-10 text-center">
        <span className="text-3xl" aria-hidden="true">🏅</span>
        <p className="text-sm text-slate-500">Complete habits to earn badges!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {badges.map((badge) => (
        <BadgeCard key={badge._id} badge={badge} earnedAt={badge.earnedAt} />
      ))}
    </div>
  );
});
