import { useEffect, useRef, useState } from 'react';

interface PullToRefreshOptions {
  /** Async callback fired when the user completes a pull gesture */
  onRefresh: () => Promise<void> | void;
  /** Pixel threshold before a refresh triggers (default 80) */
  threshold?: number;
  /** Disable the hook entirely (e.g. while already loading) */
  disabled?: boolean;
}

function getScrollTop(): number {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

/**
 * Pull-to-refresh hook for mobile.
 *
 * Never calls preventDefault — native page scroll always wins.
 * Only registers on coarse-pointer (touch) devices.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: PullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const startY = useRef(0);
  const currentPull = useRef(0);
  const pulling = useRef(false);
  const refreshing = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    // True mobile only — avoids hijacking scroll on Chrome desktop / touch laptops.
    const isMobileTouch =
      window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!isMobileTouch) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (disabledRef.current || refreshing.current) return;
      if (getScrollTop() > 2) return;

      let node = e.target as HTMLElement | null;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        const overflowY = style.overflowY;
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          node.scrollHeight > node.clientHeight + 1 &&
          node.scrollTop > 0
        ) {
          return;
        }
        node = node.parentElement;
      }

      startY.current = e.touches[0].clientY;
      pulling.current = true;
      currentPull.current = 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pulling.current) return;

      if (getScrollTop() > 2) {
        pulling.current = false;
        currentPull.current = 0;
        setPullDistance(0);
        return;
      }

      const diff = e.touches[0].clientY - startY.current;

      if (diff > 0) {
        const dampened = Math.min(diff * 0.45, thresholdRef.current * 1.6);
        currentPull.current = dampened;
        setPullDistance(dampened);
      } else {
        pulling.current = false;
        currentPull.current = 0;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;

      const distance = currentPull.current;
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
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isRefreshing, pullDistance };
}
