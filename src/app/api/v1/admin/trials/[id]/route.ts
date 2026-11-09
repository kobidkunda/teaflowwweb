/**
 * Admin Trial Dossier Detail & Concurrency Mutation API
 *
 * GET    /api/v1/admin/trials/:id — Full administrative dossier with costs & components
 * PATCH  /api/v1/admin/trials/:id — CAS optimistic revision update (returns 409 on conflict)
 * DELETE /api/v1/admin/trials/:id — Delete draft/archived trial (rejects published)
 */

import { NextResponse } from "next/server";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { TrialService } from "@/lib/trials/service";
import { updateTrialSchema } from "@/lib/trials/validation";
import {
  TrialRevisionConflictError,
  TrialNotFoundError,
  TrialInvalidStateTransitionError,
  type AuditActor,
} from "@/lib/trials/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Trial ID is required.");

  const trial = TrialService.getById(id) || TrialService.getBySlug(id);
  if (!trial) return notFound(`Trial not found: ${id}`);

  return NextResponse.json({ ...trial, trial }, { status: 200 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Trial ID is required.");

  const rawBody: Record<string, unknown> | null = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const parsed = updateTrialSchema.safeParse(rawBody);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  const existing = TrialService.getById(id) || TrialService.getBySlug(id);
  if (!existing) return notFound(`Trial not found: ${id}`);

  const expectedRevision =
    rawBody.expected_revision !== undefined
      ? Number(rawBody.expected_revision)
      : existing.revision;

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
    user_agent: request.headers.get("user-agent") || null,
  };

  try {
    const updated = TrialService.update(existing.id, expectedRevision, parsed.data, actor);
    return NextResponse.json({ ...updated, trial: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof TrialRevisionConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          current_revision: error.current_revision,
          expected_revision: error.expected_revision,
        },
        { status: 409 }
      );
    }
    if (error instanceof TrialNotFoundError) {
      return notFound(error.message);
    }
    if (error instanceof TrialInvalidStateTransitionError) {
      return conflict(error.message);
    }
    const message = error instanceof Error ? error.message : "Unable to update trial.";
    if (message.includes("already taken") || message.includes("UNIQUE") || message.includes("conflict")) {
      return conflict(message);
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Trial ID is required.");

  const existing = TrialService.getById(id) || TrialService.getBySlug(id);
  if (!existing) return notFound(`Trial not found: ${id}`);

  if (existing.status === "published") {
    return NextResponse.json(
      { error: "Cannot delete a published trial. Must unpublish or archive first." },
      { status: 400 }
    );
  }

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
  };

  try {
    TrialService.delete(existing.id, actor);
    return NextResponse.json({ success: true, deleted: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete trial.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
