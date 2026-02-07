import { memo } from 'react';

/**
 * Skeleton placeholder that matches the exact dimensions of a real game card.
 * Uses a CSS shimmer animation instead of a spinner — reduces perceived wait time.
 */
export const GameCardSkeleton = memo(function GameCardSkeleton() {
  return (
    <div className="relative casino-bg-secondary backdrop-blur-lg rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden casino-border shadow-lg">
      {/* Image area */}
      <div className="aspect-square skeleton-shimmer" />

      {/* Text area */}
      <div className="p-2 sm:p-3 lg:p-4 xl:p-5 space-y-2">
        <div className="h-3.5 sm:h-4 rounded bg-white/10 skeleton-shimmer w-3/4" />
        <div className="flex items-center justify-between">
          <div className="h-3 rounded bg-white/10 skeleton-shimmer w-1/3" />
          <div className="w-2 h-2 rounded-full bg-white/10 skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
});
