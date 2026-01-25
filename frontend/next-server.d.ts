/**
 * Type declarations for next/server when used in Vercel Edge Middleware.
 * The runtime implementation is provided by Vercel's Edge runtime at deploy time.
 * This satisfies the type checker for middleware.ts in a Vite (non-Next.js) project.
 */
declare module 'next/server' {
  export class NextResponse extends Response {
    static next(): NextResponse;
    static redirect(url: URL | string, status?: number): NextResponse;
  }
}
