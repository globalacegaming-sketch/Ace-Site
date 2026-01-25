/**
 * Type declarations for 'next/server' (NextResponse) used in Vercel Edge Middleware.
 * This is a Vite project—the `next` package is not used. The runtime implementation
 * is provided by Vercel's Edge runtime when middleware runs at deploy time.
 */
declare module 'next/server' {
  export class NextResponse extends Response {
    static next(): NextResponse;
    static redirect(url: URL | string, status?: number): NextResponse;
  }
}
