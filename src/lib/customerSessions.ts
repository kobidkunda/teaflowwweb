import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";

export const CUSTOMER_SESSION_COOKIE = "tf_customer_session";
export const CUSTOMER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SafeCustomer = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  created_at: string;
};

export function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV !== "production" ? "teafloww-customer-session-secret-key-32chars" : "")
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

export function createCustomerSession(
  customerId: string,
  now = Date.now()
): { cookieValue: string; expiresAt: string } {
  const secret = getSessionSecret();
  if (!secret) throw new Error("Customer auth is not configured.");
  const sid = randomBytes(32).toString("hex");
  const sig = hmacHex(secret, sid);
  const expiresAt = new Date(now + CUSTOMER_SESSION_TTL_MS).toISOString();

  getDb()
    .prepare(
      "INSERT INTO customer_sessions (token_hash, customer_id, expires_at) VALUES (?,?,?)"
    )
    .run(sha256hex(sid), customerId, expiresAt);

  return { cookieValue: `${sid}.${sig}`, expiresAt };
}

export function parseCustomerSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie") || "";
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() !== CUSTOMER_SESSION_COOKIE) continue;
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

export function verifyCustomerSessionValue(
  cookieValue: string,
  now = Date.now()
): SafeCustomer | null {
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
    const row = db
      .prepare("SELECT * FROM customer_sessions WHERE token_hash=?")
      .get(sha256hex(sid)) as { customer_id: string; expires_at: string } | undefined;
    if (!row) return null;

    if (!Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= now) {
      try {
        db.prepare("DELETE FROM customer_sessions WHERE token_hash=?").run(sha256hex(sid));
      } catch {
        /* best-effort */
      }
      return null;
    }

    const customer = db
      .prepare(
        "SELECT id, email, name, phone, created_at, is_active FROM customers WHERE id=?"
      )
      .get(row.customer_id) as
      | {
          id: string;
          email: string;
          name: string | null;
          phone: string | null;
          created_at: string;
          is_active: number;
        }
      | undefined;

    if (!customer || customer.is_active !== 1) return null;

    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      created_at: customer.created_at,
    };
  } catch {
    return null;
  }
}

export function getCustomerSession(request: Request): SafeCustomer | null {
  const value = parseCustomerSessionCookie(request);
  if (!value) return null;
  return verifyCustomerSessionValue(value);
}

export function revokeCustomerSession(cookieValue: string): void {
  try {
    const dot = cookieValue.indexOf(".");
    if (dot <= 0) return;
    const sid = cookieValue.slice(0, dot);
    getDb().prepare("DELETE FROM customer_sessions WHERE token_hash=?").run(sha256hex(sid));
  } catch {
    /* best effort */
  }
}
