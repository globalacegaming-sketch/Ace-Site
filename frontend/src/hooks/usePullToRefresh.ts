import { useEffect, useRef, useState } from 'react';

interface PullToRefreshOptions {
  /** Async callback fired when the user completes a pull gesture */
  onRefresh: () => Promise<void> | void;
  /** Pixel threshold before a refresh triggers (default 80) */
  threshold?: number;
  /** Disable the hook entirely (e.g. while already loading) */
  disabled?: boolean;
}

/**
 * Pull-to-refresh hook for mobile.
 *
 * All gesture tracking lives in refs so touchend always reads the
 * latest pull distance — no stale-closure issues.
 *
 * State (`pullDistance`, `isRefreshing`) is only written for the
 * visual indicator; the actual trigger logic never depends on it.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: PullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  // ——— refs that hold the real gesture state ———
  const startY = useRef(0);
  const currentPull = useRef(0);   // dampened px — source of truth
  const pulling = useRef(false);
  const refreshing = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    // ——— handlers read only from refs, never from React state ———

    const handleTouchStart = (e: TouchEvent) => {
      if (disabledRef.current || refreshing.current) return;

      // Only activate when the page itself is scrolled to the very top.
      // This avoids hijacking scroll inside child containers (modals,
      // overflow divs, etc.).
      if (window.scrollY > 0) return;

      startY.current = e.touches[0].clientY;
      pulling.current = true;
      currentPull.current = 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pulling.current) return;

      // If the page has scrolled since touchstart (e.g. user scrolled
      // a child div), bail out of the pull gesture entirely.
      if (window.scrollY > 0) {
        pulling.current = false;
        currentPull.current = 0;
        setPullDistance(0);
        return;
      }

      const diff = e.touches[0].clientY - startY.current;

      if (diff > 0) {
        // Dampened "rubber-band" feel
        const dampened = Math.min(diff * 0.45, thresholdRef.current * 1.6);
        currentPull.current = dampened;
        setPullDistance(dampened);

        // Prevent native scroll / bounce only while we're visibly pulling
        if (diff > 10) {
          e.preventDefault();
        }
      } else {
        // User moved upward — cancel pull, let normal scroll take over
        pulling.current = false;
        currentPull.current = 0;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;

      const distance = currentPull.current;   // always fresh
      currentPull.current = 0;

      if (distance >= thresholdRef.current) {
        refreshing.current = true;
        setIsRefreshing(true);
        setPullDistance(0);
        try {
          await onRefreshRef.current();
        } finally {
          refreshing.current = false;
          setIsRefreshing(false);
        }
      } else {
        setPullDistance(0);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    // Intentionally empty — everything is ref-based so a single
    // registration lasts the lifetime of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isRefreshing, pullDistance };
}
