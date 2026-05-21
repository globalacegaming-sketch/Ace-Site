/**
 * Centralized auth API client.
 *
 * Replaces the inline `fetch` / `axios.post` calls scattered across the auth
 * pages with typed wrappers that throw structured errors instead of raw
 * strings, so callers can branch on `LoginError.apiCode` or `httpStatus`
 * (e.g. surface `EMAIL_NOT_VERIFIED` or HTTP 429 differently).
 */

import type { User } from '../types';
import { getApiBaseUrl } from '../utils/api';

/* ------------------------------------------------------------------------- */
/* Response shapes (mirror existing backend `auth.ts` route responses)        */
/* ------------------------------------------------------------------------- */

export type AuthBackendResponse = {
  success: boolean;
  message?: string;
  code?: string;
  data?: {
    user?: User;
    accessToken?: string;
    expiresAt?: string;
    fortunePanda?: {
      username: string;
      password: string;
    };
  };
};

export type LoginSuccess = {
  message: string;
  user: User;
  accessToken: string;
  expiresAt: string;
};

export type RegisterSuccess = {
  message: string;
  user: User;
  accessToken: string;
  expiresAt: string;
  fortunePanda?: { username: string; password: string };
};

/* ------------------------------------------------------------------------- */
/* Typed error                                                                */
/* ------------------------------------------------------------------------- */

/**
 * Domain-specific error thrown by every auth wrapper.
 *
 * Lets callers distinguish:
 *   - `apiCode === 'ACCOUNT_BANNED'`   -> server-side ban
 *   - `apiCode === 'EMAIL_NOT_VERIFIED'` -> bounce to /verify-code
 *   - `httpStatus === 429`              -> rate limited
 */
export class LoginError extends Error {
  readonly httpStatus: number;
  readonly apiCode?: string;

  constructor(message: string, httpStatus: number, apiCode?: string) {
    super(message);
    this.name = 'LoginError';
    this.httpStatus = httpStatus;
    this.apiCode = apiCode;
  }
}

/* ------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* ------------------------------------------------------------------------- */

function apiUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

async function parseJson(res: Response): Promise<AuthBackendResponse> {
  try {
    return (await res.json()) as AuthBackendResponse;
  } catch {
    return { success: false, message: res.statusText || 'Unexpected response' };
  }
}

function buildError(
  body: AuthBackendResponse,
  status: number,
  fallback: string,
): LoginError {
  return new LoginError(body.message ?? fallback, status, body.code);
}

async function postJson<T>(
  path: string,
  payload: unknown,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    credentials: 'include',
    body: JSON.stringify(payload),
    ...init,
  });
  const body = await parseJson(res);
  if (!res.ok || !body.success) {
    throw buildError(body, res.status, 'Request failed');
  }
  return body as unknown as T;
}

/* ------------------------------------------------------------------------- */
/* Public surface                                                             */
/* ------------------------------------------------------------------------- */

export async function loginAccount(payload: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<LoginSuccess> {
  const res = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res);
  if (!res.ok || !body.success) {
    throw buildError(body, res.status, 'Login failed');
  }
  if (!body.data?.user || !body.data.accessToken) {
    throw new LoginError('Malformed login response', res.status);
  }
  return {
    message: body.message ?? 'Login successful',
    user: body.data.user,
    accessToken: body.data.accessToken,
    expiresAt:
      body.data.expiresAt ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function registerAccount(payload: {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  referralCode?: string;
}): Promise<RegisterSuccess> {
  const res = await fetch(apiUrl('/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res);
  if (!res.ok || !body.success) {
    throw buildError(body, res.status, 'Registration failed');
  }
  if (!body.data?.user || !body.data.accessToken) {
    throw new LoginError('Malformed register response', res.status);
  }
  return {
    message: body.message ?? 'Account created',
    user: body.data.user,
    accessToken: body.data.accessToken,
    expiresAt:
      body.data.expiresAt ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    fortunePanda: body.data.fortunePanda,
  };
}

export async function requestPasswordReset(email: string): Promise<string> {
  const body = await postJson<AuthBackendResponse>(
    '/auth/forgot-password',
    { email },
  );
  return body.message ?? 'If an account with that email exists, a reset link has been sent.';
}

export async function resetPasswordWithToken(payload: {
  token: string;
  password: string;
}): Promise<string> {
  const body = await postJson<AuthBackendResponse>(
    '/auth/reset-password',
    payload,
  );
  return body.message ?? 'Password reset successfully';
}

export async function verifyEmailWithToken(
  token: string,
): Promise<string> {
  const body = await postJson<AuthBackendResponse>(
    '/auth/verify-email',
    { token },
  );
  return body.message ?? 'Email verified';
}

export async function verifyEmailWithCode(payload: {
  email: string;
  code: string;
}): Promise<string> {
  const body = await postJson<AuthBackendResponse>(
    '/auth/verify-email',
    payload,
  );
  return body.message ?? 'Email verified';
}

export async function resendVerificationCode(payload: {
  email?: string;
  token?: string;
}): Promise<string> {
  // Authenticated flow (has token) hits a different endpoint than the
  // public flow (email-only). We pick the right one for the caller.
  if (payload.token) {
    const res = await fetch(apiUrl('/auth/resend-verification'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.token}`,
      },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    const body = await parseJson(res);
    if (!res.ok || !body.success) {
      throw buildError(body, res.status, 'Failed to resend code');
    }
    return body.message ?? 'Verification code sent';
  }
  const body = await postJson<AuthBackendResponse>(
    '/auth/resend-verification-code',
    { email: payload.email },
  );
  return body.message ?? 'Verification code sent';
}

export async function fetchMe(token: string): Promise<User> {
  const res = await fetch(apiUrl('/auth/me'), {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  const body = await parseJson(res);
  if (!res.ok || !body.success || !body.data?.user) {
    throw buildError(body, res.status, 'Failed to load profile');
  }
  return body.data.user;
}
