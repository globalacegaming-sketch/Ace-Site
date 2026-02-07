import { Loader2 } from 'lucide-react';

interface Props {
  isRefreshing: boolean;
  pullDistance: number;
}

/**
 * Visual indicator shown at the top of the page during pull-to-refresh.
 * Shows a rotating spinner when refreshing, or a downward-progress circle during pull.
 */
export function PullToRefreshIndicator({ isRefreshing, pullDistance }: Props) {
  if (!isRefreshing && pullDistance <= 0) return null;

  return (
    <div
      className="ptr-indicator fixed top-16 left-1/2 z-50 flex items-center justify-center"
      style={{
        transform: `translate(-50%, ${isRefreshing ? 0 : pullDistance * 0.3}px)`,
        opacity: isRefreshing ? 1 : Math.min(pullDistance / 60, 1),
      }}
    >
      <div className="bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm">
        <Loader2
          className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            transform: isRefreshing
              ? undefined
              : `rotate(${pullDistance * 3.6}deg)`,
          }}
        />
        {isRefreshing ? 'Refreshing...' : 'Pull to refresh'}
      </div>
    </div>
  );
}
