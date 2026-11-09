import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation";
import { invalid } from "@/lib/adminHttp";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { verifyPassword, verifyDummy } from "@/lib/password";
import {
  ensureRootBootstrap,
  getUserByUsername,
  isLocked,
  normalizeUsername,
  recordFailedAttempt,
  resetLockout,
  toSafeUser,
} from "@/lib/adminUsers";
import { buildSessionCookie, createAdminSession, pruneExpiredSessions } from "@/lib/adminSessions";

export const runtime = "nodejs";

// POST /api/admin/login { username, password } → 200 { ok, user } + session
// cookie. Generic 401 on any credential failure (unknown user, wrong
// password, inactive, locked) so usernames cannot be enumerated. Tight
// per-IP budget plus per-account 5→15min lockout.
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "login", RATE_LIMITS.login);
  if (limited) return limited;
  const body: unknown = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  ensureRootBootstrap();
  pruneExpiredSessions();
  const username = normalizeUsername(parsed.data.username);
  const user = getUserByUsername(username);
  if (!user) {
    verifyDummy(parsed.data.password);
    logger.warn("admin login failed", { route: "/api/admin/login" });
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  if (user.is_active !== 1 || isLocked(user)) {
    logger.warn("admin login refused", { route: "/api/admin/login" });
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  if (!verifyPassword(parsed.data.password, user.password_hash)) {
    recordFailedAttempt(user);
    logger.warn("admin login failed", { route: "/api/admin/login" });
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  resetLockout(user.id);
  let cookieValue = "";
  try {
    cookieValue = createAdminSession(user.id).cookieValue;
  } catch {
    logger.error("admin session issuance failed", { route: "/api/admin/login" });
    return NextResponse.json({ error: "Unable to complete the request." }, { status: 503 });
  }
  const safe = toSafeUser({ ...user });
  logger.info("admin login", { route: "/api/admin/login" });
  const res = NextResponse.json({ ok: true, user: safe });
  res.headers.set("Set-Cookie", buildSessionCookie(cookieValue));
  res.headers.set("Cache-Control", "no-store");
  return res;
}
