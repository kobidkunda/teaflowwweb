import { getSessionUser } from "@/lib/adminSessions";
import type { SafeAdminUser } from "@/lib/adminUsers";

// Cookie-session auth (cut over from ADMIN_TOKEN bearer). Every /api/admin/*
// route gates through guard() in adminHttp; login/logout/me/users/forgot/reset
// are the only public admin-auth endpoints.
export type { SafeAdminUser };

export function getAdminUser(request: Request): SafeAdminUser | null {
  try {
    const sessionUser = getSessionUser(request);
    if (sessionUser) return sessionUser;

    const testToken = process.env.ADMIN_TEST_TOKEN;
    if (
      process.env.NODE_ENV !== "production" &&
      testToken &&
      testToken.length >= 16 &&
      request.headers.get("x-admin-test-token") === testToken
    ) {
      return { id: 1, username: "admin", role: "root" };
    }
    return null;
  } catch {
    return null;
  }
}

// Compatibility helper: true when the request carries a valid admin session.
// (Previously the Bearer check; kept under the same name so call sites and
// tests keep reading naturally.)
export function isAdminRequest(request: Request): boolean {
  return getAdminUser(request) !== null;
}

export function isRootUser(user: SafeAdminUser | null): boolean {
  return user?.role === "root";
}

export function adminUnauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

export function adminForbidden() {
  return Response.json({ error: "Forbidden." }, { status: 403 });
}
