import { NextResponse } from "next/server";
import { guard } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";

export const runtime = "nodejs";

// GET /api/admin/me → 200 { user } for a valid session, else 401.
export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const user = getAdminUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const res = NextResponse.json({ user });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
