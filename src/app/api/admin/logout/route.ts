import { NextResponse } from "next/server";
import { clearSessionCookie, parseSessionCookie, revokeSession } from "@/lib/adminSessions";

export const runtime = "nodejs";

// POST /api/admin/logout → always 200 { ok:true }, revokes the current
// session when present and clears the cookie (idempotent, no auth needed).
export function POST(request: Request) {
  const value = parseSessionCookie(request);
  if (value) revokeSession(value);
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookie());
  res.headers.set("Cache-Control", "no-store");
  return res;
}
