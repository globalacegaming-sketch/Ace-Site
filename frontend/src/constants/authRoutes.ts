/** Every auth-flow route (no footer, compact layout). */
export const AUTH_LAYOUT_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-code',
];

/**
 * Focused auth flows: no site header and no mobile tab bar. These screens have
 * their own back control. Login, register and forgot-password keep the normal
 * header so users can still reach Games / Platforms / Bonuses / Support.
 */
export const FOCUSED_AUTH_ROUTES = ['/reset-password', '/verify-email', '/verify-code'];

export const isFocusedAuthRoute = (pathname: string) =>
  FOCUSED_AUTH_ROUTES.some((p) => pathname.startsWith(p));
