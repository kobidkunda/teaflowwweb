import { NextResponse, type NextRequest } from "next/server";
import { SECURITY_HEADERS } from "@/lib/security";

/**
 * Stamp baseline security headers on every response. Runs at the edge of
 * every route (pages, API, MCP) so individual handlers cannot forget them.
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const match = /^\/(hi|bn|ar|fr|de|es|pt|ja|zh-CN)(?=\/|$)/.exec(path);
  const headers = new Headers(request.headers);
  headers.set("x-teafloww-locale", match?.[1] || "en");
  headers.set("x-teafloww-path", path);
  const url = request.nextUrl.clone();
  if (match) url.pathname = path.slice(match[0].length) || "/";
  const forbiddenLocale = Boolean(match && /^\/(api|admin|mcp|feeds|purchase|order|_next|uploads)(?:\/|$)/.test(url.pathname));
  let response = forbiddenLocale ? NextResponse.json({ error: "Not found." }, { status: 404 }) : match ? NextResponse.rewrite(url, { request: { headers } }) : NextResponse.next({ request: { headers } });
  // No third-party page scripts see a signed access token in the document URL.
  // This cookie is untrusted until the Node route verifies the HMAC and expiry.
  const token = request.nextUrl.searchParams.get("token");
  if (/^\/purchase\/[a-f0-9-]{36}$/.test(path) && token) {
    if (!/^\d{13}\.[a-f0-9]{64}$/.test(token)) response = NextResponse.json({ error: "Not found." }, { status: 404 });
    else {
      const clean = request.nextUrl.clone(); clean.searchParams.delete("token");
      response = NextResponse.redirect(clean);
      response.cookies.set("tf_order_access", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path, maxAge: Math.max(0, Math.min(7 * 86400, Math.floor((Number(token.split(".")[0]) - Date.now()) / 1000))) });
    }
  }
  const isStaticPublicAsset =
    path.startsWith("/_next") ||
    path.startsWith("/uploads") ||
    path.startsWith("/images") ||
    path.startsWith("/logo") ||
    path.startsWith("/favicon") ||
    path === "/icon.svg" ||
    path === "/manifest.json" ||
    path === "/site.webmanifest" ||
    /\.(jpg|jpeg|png|webp|avif|svg|ico|css|js|woff2?)$/i.test(path);

  const isPrivateOrAdmin =
    path.startsWith("/admin") ||
    path.startsWith("/account") ||
    path.startsWith("/checkout") ||
    path.startsWith("/cart") ||
    path.startsWith("/order") ||
    path.startsWith("/purchase") ||
    path.startsWith("/api/");

  if (isPrivateOrAdmin) {
    response.headers.set("Cache-Control", "private, no-store");
  } else if (!isStaticPublicAsset) {
    // Public indexable storefront pages and feeds: allow edge CDN caching while enforcing browser revalidation
    response.headers.set("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  }
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  if (path.startsWith("/uploads/") && path.toLowerCase().endsWith(".pdf")) {
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    const currentCsp = response.headers.get("Content-Security-Policy");
    if (currentCsp) {
      response.headers.set(
        "Content-Security-Policy",
        currentCsp.replace("frame-ancestors 'none'", "frame-ancestors 'self'")
      );
    }
  }
  if (path.startsWith("/purchase/") || path === "/api/commerce/order") response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = {
  matcher: ["/:path*"],
};
