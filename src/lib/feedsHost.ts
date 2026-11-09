/**
 * Client-safe host validation utilities for product feeds.
 * Free of Node.js dependencies (fs, crypto, better-sqlite3) for safe bundling in client components.
 */

export function isPrivateHost(urlOrHost: string): boolean {
  if (!urlOrHost) return false;
  const host = urlOrHost.replace(/^https?:\/\//i, "").split(/[:/]/)[0].toLowerCase().trim();
  if (!host) return false;
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".test")
  ) {
    return true;
  }
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true;
  return false;
}
