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
// Official Meta GTM template loads this package; unpkg redirects to a versioned URL.
// Allow the helper file only, rather than granting either CDN blanket script access.
const metaCapiScripts = [
  "https://cdn.jsdelivr.net/npm/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js",
  "https://unpkg.com/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js",
  "https://unpkg.com/meta-capi-param-builder-clientjs@1.3.3/dist/clientParamBuilder.bundle.js",
].join(" ");
const scriptSrc = [
  "script-src 'self' 'unsafe-inline'",
  ...(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"]),
  "https://www.googletagmanager.com https://tagmanager.google.com https://www.googleadservices.com https://www.google.com https://connect.facebook.net https://static.cloudflareinsights.com https://checkout.razorpay.com",
  metaCapiScripts,
].join(" ");
// These exact CAPI destinations were verified in Meta's public config for pixel
// 1128432123376468 / teafloww.com. Do not allow arbitrary cloud.run/on.aws hosts.
const metaCapiConnections = "https://1c-e0e78bd7d7fd408d87142c500d5b8890.ecs.us-west-1.on.aws https://vwdb33u4tj1q.cloud.run";
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
    "style-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://tagmanager.google.com https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://pay-api.biolastic.co.in https://pay.biolastic.co.in https://pay-admin.biolastic.co.in https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.googletagmanager.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://ad.doubleclick.net https://www.google.com https://www.google.co.in https://connect.facebook.net https://www.facebook.com https://*.facebook.com https://cloudflareinsights.com https://*.cloudflareinsights.com " + metaCapiConnections,
    // Meta Pixel can send events through an iframe/form fallback.
    "frame-src 'self' https://www.facebook.com https://api.razorpay.com https://checkout.razorpay.com https://pay.biolastic.co.in https://pay-admin.biolastic.co.in https://www.googletagmanager.com https://www.youtube.com https://www.youtube-nocookie.com",
    "media-src 'self' https: data: blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://pay.biolastic.co.in https://www.facebook.com/tr/",
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
