/// <reference path="./next-server.d.ts" />
import { NextResponse } from 'next/server';

const MAIN_DOMAINS = ['globalacegaming.com', 'www.globalacegaming.com'];
/** aceadmin — /aceadmin/login, /aceadmin/dashboard */
const AGENT_SUBDOMAIN = 'aceadmin.globalacegaming.com';
/** aceagent — /aceagent, /aceagent/login */
const ADMIN_SUBDOMAIN = 'aceagent.globalacegaming.com';

const BLOCKED_ON_MAIN = ['/aceadmin', '/aceagent'];

function isLocalDev(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function pathIsBlocked(pathname: string): boolean {
  return BLOCKED_ON_MAIN.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
}

export function middleware(request: Request) {
  const url = new URL(request.url);
  const hostname = url.hostname;
  const pathname = url.pathname;

  // Local dev: allow all routes (no hostname-based blocking)
  if (isLocalDev(hostname)) {
    return NextResponse.next();
  }

  const isMain = MAIN_DOMAINS.includes(hostname);
  const isAgentSubdomain = hostname === AGENT_SUBDOMAIN;   // aceadmin → /aceadmin/login, /aceadmin/dashboard
  const isAdminSubdomain = hostname === ADMIN_SUBDOMAIN;   // aceagent → /aceagent, /aceagent/login

  // Main domain: block role-based paths → redirect to /
  if (isMain && pathIsBlocked(pathname)) {
    return NextResponse.redirect(new URL('/', url.origin), 302);
  }

  // aceadmin (agent): / → /aceadmin/login; block /aceagent*
  if (isAgentSubdomain) {
    if (pathname === '/' || pathname === '') {
      return NextResponse.redirect(new URL('/aceadmin/login', url.origin), 302);
    }
    if (pathname.startsWith('/aceagent')) {
      return NextResponse.redirect(new URL('/aceadmin/login', url.origin), 302);
    }
  }

  // aceagent (admin): / → /aceagent/login; block /aceadmin*
  if (isAdminSubdomain) {
    if (pathname === '/' || pathname === '') {
      return NextResponse.redirect(new URL('/aceagent/login', url.origin), 302);
    }
    if (pathname.startsWith('/aceadmin')) {
      return NextResponse.redirect(new URL('/aceagent/login', url.origin), 302);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on all non-asset paths (skip /assets/ for Vite build output)
  matcher: ['/((?!assets/).*)', '/'],
};
