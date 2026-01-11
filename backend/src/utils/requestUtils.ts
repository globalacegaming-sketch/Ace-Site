import { Request } from 'express';

/**
 * Get the client's IP address from the request
 * Handles proxy headers (X-Forwarded-For, X-Real-IP, etc.)
 */
export function getClientIP(req: Request): string {
  // Check various headers in order of preference
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, get the first one (original client)
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
    return ips.trim();
  }

  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
  if (cfConnectingIP) {
    return Array.isArray(cfConnectingIP) ? cfConnectingIP[0] : cfConnectingIP;
  }

  // Fallback to connection remote address
  if (req.socket?.remoteAddress) {
    return req.socket.remoteAddress;
  }

  // Last resort fallback
  return req.ip || 'unknown';
}

