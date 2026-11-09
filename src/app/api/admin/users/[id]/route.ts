import { NextResponse } from "next/server";
import { guardRoot, invalid, notFound, conflict } from "@/lib/adminHttp";
import { updateUserSchema } from "@/lib/validation";
import { getAdminUser } from "@/lib/adminAuth";
import {
  countActiveRoots,
  getUserById,
  setUserActive,
  setUserEmail,
  setUserRole,
  updateUserPassword,
} from "@/lib/adminUsers";
import { revokeUserSessions } from "@/lib/adminSessions";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function idOf(params: { id?: string }): number | null {
  const n = parseInt(params.id || "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// GET /api/admin/users/:id
// Root-only: returns user details without password_hash.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guardRoot(request);
  if (denied) return denied;
  const { id } = await params;
  const targetId = idOf({ id });
  if (targetId === null) return invalid({ id: ["Enter a valid user id."] });
  const target = getUserById(targetId);
  if (!target) return notFound("User not found.");
  return NextResponse.json({
    user: {
      id: target.id,
      username: target.username,
      email: target.email,
      role: target.role,
      is_active: target.is_active,
      failed_attempts: target.failed_attempts,
      locked_until: target.locked_until,
      created_at: target.created_at,
    },
  });
}

// PATCH /api/admin/users/:id { password?, role?, is_active?, email? }
// Root-only. Guards: never disable/demote yourself, never remove the last
// active root. Password changes revoke that user's sessions.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guardRoot(request);
  if (denied) return denied;
  const { id } = await params;
  const targetId = idOf({ id });
  if (targetId === null) return invalid({ id: ["Enter a valid user id."] });
  const body: unknown = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  const target = getUserById(targetId);
  if (!target) return notFound("User not found.");
  const caller = getAdminUser(request);
  const data = parsed.data;
  try {
    if (data.role !== undefined) {
      if (caller && caller.id === targetId && data.role !== "root") {
        return conflict("You cannot change your own role.");
      }
      if (target.role === "root" && data.role !== "root" && countActiveRoots(targetId) < 1) {
        return conflict("At least one active root must remain.");
      }
      setUserRole(targetId, data.role);
    }
    if (data.is_active !== undefined) {
      const next = data.is_active === 1;
      if (caller && caller.id === targetId && !next) {
        return conflict("You cannot disable your own account.");
      }
      if (target.role === "root" && !next && countActiveRoots(targetId) < 1) {
        return conflict("At least one active root must remain.");
      }
      setUserActive(targetId, next);
      if (!next) revokeUserSessions(targetId);
    }
    if (data.email !== undefined) {
      try {
        setUserEmail(targetId, data.email);
      } catch {
        return conflict("Email already exists.");
      }
    }
    if (data.password !== undefined) {
      updateUserPassword(targetId, data.password);
      revokeUserSessions(targetId);
    }
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to update the user.");
  }
  const updated = getUserById(targetId);
  logger.info("admin user updated", { route: "/api/admin/users" });
  return NextResponse.json({
    user: updated ? { id: updated.id, username: updated.username, email: updated.email, role: updated.role, is_active: updated.is_active } : null,
  });
}

// DELETE /api/admin/users/:id → deactivates (never hard-deletes, audit-safe).
// Same self/last-root guards as PATCH.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guardRoot(request);
  if (denied) return denied;
  const { id } = await params;
  const targetId = idOf({ id });
  if (targetId === null) return invalid({ id: ["Enter a valid user id."] });
  const target = getUserById(targetId);
  if (!target) return notFound("User not found.");
  const caller = getAdminUser(request);
  if (caller && caller.id === targetId) return conflict("You cannot disable your own account.");
  if (target.role === "root" && countActiveRoots(targetId) < 1) {
    return conflict("At least one active root must remain.");
  }
  setUserActive(targetId, false);
  revokeUserSessions(targetId);
  logger.info("admin user disabled", { route: "/api/admin/users" });
  return NextResponse.json({ ok: true });
}
