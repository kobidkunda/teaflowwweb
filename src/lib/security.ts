import type { NextResponse } from "next/server";

/**
 * Baseline security headers for every response. Applied in one place
 * (src/middleware.ts) so no route can forget them; `applySecurityHeaders`
 * is exported so route-level tests can assert the same contract.
 *
 * CSP keeps 'unsafe-inline' for scripts/styles because Next.js hydration
 * needs inline bootstraps without per-request nonces. Development builds
 * additionally require 'unsafe-eval' for React Refresh / devtools eval;
 * without it the dev server hydrates no interactivity (dead clicks on the
 * PDP add-to-bag and tea-finder flows). Production stays strict: no eval.
 */
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://static.cloudflareinsights.com https://checkout.razorpay.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net https://static.cloudflareinsights.com https://checkout.razorpay.com";
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Content-Security-Policy": [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.googletagmanager.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://connect.facebook.net https://www.facebook.com https://*.facebook.com https://cloudflareinsights.com https://*.cloudflareinsights.com",
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.googletagmanager.com https://www.youtube.com https://www.youtube-nocookie.com",
    "media-src 'self' https: data: blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

export function applySecurityHeaders<T extends NextResponse>(
  response: T
): T {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}
