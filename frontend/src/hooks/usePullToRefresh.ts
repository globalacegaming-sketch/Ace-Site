import { useCallback, useEffect, useRef, useState } from 'react';

interface PullToRefreshOptions {
  /** Async callback fired when the user completes a pull gesture */
  onRefresh: () => Promise<void> | void;
  /** Pixel threshold before a refresh triggers (default 80) */
  threshold?: number;
  /** Disable the hook entirely (e.g. while already loading) */
  disabled?: boolean;
}

/**
 * Lightweight pull-to-refresh hook for mobile.
 * Attach `containerRef` to the scrollable element (defaults to window).
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: PullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const stableRefresh = useRef(onRefresh);
  stableRefresh.current = onRefresh;

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      const scrollTop = containerRef.current
        ? containerRef.current.scrollTop
        : window.scrollY;
      if (scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    },
    [disabled, isRefreshing],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pulling.current) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 0) {
        // Dampened distance so the pull feels "rubbery"
        const dampened = Math.min(diff * 0.45, threshold * 1.6);
        setPullDistance(dampened);
        if (diff > 10) e.preventDefault(); // prevent scroll while pulling
      } else {
        pulling.current = false;
        setPullDistance(0);
      }
    },
    [threshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(0);
      try {
        await stableRefresh.current();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold]);

  useEffect(() => {
    if (disabled) return;
    const opts: AddEventListenerOptions = { passive: false };
    const el = containerRef.current ?? document;

    el.addEventListener('touchstart', handleTouchStart as EventListener, { passive: true });
    el.addEventListener('touchmove', handleTouchMove as EventListener, opts);
    el.addEventListener('touchend', handleTouchEnd as EventListener);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart as EventListener);
      el.removeEventListener('touchmove', handleTouchMove as EventListener);
      el.removeEventListener('touchend', handleTouchEnd as EventListener);
    };
  }, [disabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { isRefreshing, pullDistance, containerRef };
}
