import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { getUserById, toSafeUser, type SafeAdminUser } from "@/lib/adminUsers";

export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV !== "production" ? "trials-dev-session-secret-key-32chars" : "")
  );
}

function sha256hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export function createAdminSession(userId: number, now = Date.now()): { cookieValue: string; expiresAt: string } {
  const secret = getSessionSecret();
  if (!secret) throw new Error("Auth is not configured.");
  const sid = randomBytes(32).toString("hex");
  const sig = hmacHex(secret, sid);
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  getDb().prepare("INSERT INTO admin_sessions (token_hash, user_id, expires_at) VALUES (?,?,?)").run(sha256hex(sid), userId, expiresAt);
  return { cookieValue: sid + "." + sig, expiresAt };
}

export function parseSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie") || "";
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() !== SESSION_COOKIE) continue;
    const value = part.slice(idx + 1).trim().replace(/^"|"$/g, "");
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

export function verifySessionValue(cookieValue: string, now = Date.now()): SafeAdminUser | null {
  try {
    const secret = getSessionSecret();
    if (!secret || !cookieValue) return null;
    const dot = cookieValue.indexOf(".");
    if (dot <= 0) return null;
    const sid = cookieValue.slice(0, dot);
    const sig = cookieValue.slice(dot + 1);
    if (!/^[0-9a-f]{32,128}$/.test(sid) || !/^[0-9a-f]{32,128}$/.test(sig)) return null;
    if (!safeEqualHex(hmacHex(secret, sid), sig)) return null;
    const db = getDb();
    const row = db.prepare("SELECT * FROM admin_sessions WHERE token_hash=?").get(sha256hex(sid)) as
      | { user_id: number; expires_at: string }
      | undefined;
    if (!row) return null;
    if (!Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= now) {
      try {
        db.prepare("DELETE FROM admin_sessions WHERE token_hash=?").run(sha256hex(sid));
      } catch {
        /* best-effort */
      }
      return null;
    }
    const user = getUserById(row.user_id);
    if (!user || user.is_active !== 1) return null;
    return toSafeUser(user);
  } catch {
    return null;
  }
}

export function getSessionUser(request: Request): SafeAdminUser | null {
  const value = parseSessionCookie(request);
  if (!value) return null;
  return verifySessionValue(value);
}

export function revokeSession(cookieValue: string): void {
  try {
    const dot = cookieValue.indexOf(".");
    const sid = dot > 0 ? cookieValue.slice(0, dot) : cookieValue;
    if (!/^[0-9a-f]{32,128}$/.test(sid)) return;
    getDb().prepare("DELETE FROM admin_sessions WHERE token_hash=?").run(sha256hex(sid));
  } catch {
    /* best-effort */
  }
}

export function revokeUserSessions(userId: number): void {
  try {
    getDb().prepare("DELETE FROM admin_sessions WHERE user_id=?").run(userId);
  } catch {
    /* best-effort */
  }
}

export function pruneExpiredSessions(now = Date.now()): void {
  try {
    getDb().prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(new Date(now).toISOString());
  } catch {
    /* best-effort */
  }
}

export function buildSessionCookie(value: string): string {
  const maxAge = Math.max(1, Math.round(SESSION_TTL_MS / 1000));
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return SESSION_COOKIE + "=" + encodeURIComponent(value) + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge + secure;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return SESSION_COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" + secure;
}
