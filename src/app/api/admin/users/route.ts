import { NextResponse } from "next/server";
import { guardRoot, invalid, conflict } from "@/lib/adminHttp";
import { createUserSchema } from "@/lib/validation";
import { createAdminUser } from "@/lib/adminUsers";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Root-only staff management. 401 unauthenticated, 403 non-root, generic
// errors so usernames/emails cannot be probed beyond the root console.
export function GET(request: Request) {
  const denied = guardRoot(request);
  if (denied) return denied;
  const users = getDb()
    .prepare(
      "SELECT id, username, email, role, is_active, failed_attempts, locked_until, created_at FROM admin_users ORDER BY id"
    )
    .all();
  const res = NextResponse.json({ users });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(request: Request) {
  const denied = guardRoot(request);
  if (denied) return denied;
  const body: unknown = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  try {
    const user = createAdminUser(parsed.data);
    logger.info("admin user created", { route: "/api/admin/users" });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to create the user.";
    if (/already exists|unknown role/i.test(message)) return conflict(message);
    logger.error("admin user create failed", { route: "/api/admin/users" });
    return conflict("Unable to complete the request.");
  }
}
