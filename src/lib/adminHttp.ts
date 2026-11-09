import { NextResponse } from "next/server";
import { getAdminUser, isRootUser, adminUnauthorized, adminForbidden } from "@/lib/adminAuth";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
// Shared admin-route plumbing: rate-limit shed, cookie-session gate, generic errors.
// No SQL here. The 429/401/403 bodies are generic and never echo secrets.
export function guard(request: Request): Response | null {
  const limited = rateLimitResponse(request, "admin", RATE_LIMITS.admin);
  if (limited) return limited;
  if (!getAdminUser(request)) return adminUnauthorized();
  return null;
}
// Root-only endpoints (user management): 401 when unauthenticated, 403 when
// a non-root staff session calls. Same rate-limit budget as guard().
export function guardRoot(request: Request): Response | null {
  const denied = guard(request);
  if (denied) return denied;
  if (!isRootUser(getAdminUser(request))) return adminForbidden();
  return null;
}
export function invalid(detail: unknown): NextResponse {
  return NextResponse.json({ error: "Please check the submitted fields.", detail }, { status: 400 });
}
export function notFound(message = "Not found."): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}
export function conflict(message: string): NextResponse {
  // Customer/admin-facing errors must stay generic: raw DB text (constraint
  // names, table/column internals) is never safe to echo. Service-thrown
  // domain messages ("Category not found.", transition rules) pass through.
  const raw = /sqlite|database|constraint|unique|foreign|syntax|table|column|abort|trigger|index/i.test(
    message
  );
  return NextResponse.json(
    { error: raw ? "Unable to complete the request." : message.slice(0, 160) },
    { status: 409 }
  );
}
export function keyOf(request: Request, body: { idempotencyKey?: string }): string | undefined {
  return request.headers.get("Idempotency-Key") ?? body.idempotencyKey;
}
