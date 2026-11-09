import { NextResponse } from "next/server";
import { guardRoot, invalid, notFound, conflict } from "@/lib/adminHttp";
import { getUserById, updateUserPassword } from "@/lib/adminUsers";
import { revokeUserSessions } from "@/lib/adminSessions";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function idOf(params: { id?: string }): number | null {
  const n = parseInt(params.id || "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// POST /api/admin/users/:id/reset
// Root-only: sets a new password (min 12 chars) and immediately revokes all
// active sessions for that user across all devices.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guardRoot(request);
  if (denied) return denied;

  const { id } = await params;
  const targetId = idOf({ id });
  if (targetId === null) return invalid({ id: ["Enter a valid user id."] });

  const target = getUserById(targetId);
  if (!target) return notFound("User not found.");

  const body: unknown = await request.json().catch(() => null);
  const data = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const password = typeof data.password === "string" ? data.password : typeof data.new_password === "string" ? data.new_password : "";

  if (!password || password.length < 12) {
    return invalid({ password: ["Passwords need at least 12 characters."] });
  }

  try {
    updateUserPassword(targetId, password);
    getDb()
      .prepare("UPDATE admin_users SET locked_until = NULL, failed_attempts = 0 WHERE id = ?")
      .run(targetId);
    revokeUserSessions(targetId);
    logger.info("admin user password reset, lockout cleared, and sessions revoked", {
      route: "/api/admin/users/[id]/reset",
      targetId,
    });

    return NextResponse.json({
      success: true,
      message: "Password updated and all sessions revoked.",
    });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to reset staff password.");
  }
}
