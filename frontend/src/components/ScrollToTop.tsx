import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

function scrollWindowToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/**
 * Resets scroll position when navigating to a new route (pathname change).
 * Hash-only changes (e.g. /#platforms) are left alone so in-page anchors still work.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    scrollWindowToTop();
  }, [pathname]);

  return null;
}
