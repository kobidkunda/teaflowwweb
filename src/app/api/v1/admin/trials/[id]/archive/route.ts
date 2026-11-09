/**
 * Admin Trial Archive API
 *
 * POST /api/v1/admin/trials/:id/archive
 * Transitions trial lifecycle state to 'archived' under CAS revision control.
 * Protects historical order line items while removing trial from active studio operations.
 */

import { NextResponse } from "next/server";
import { guard, notFound } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { TrialService } from "@/lib/trials/service";
import {
  TrialRevisionConflictError,
  TrialNotFoundError,
  TrialInvalidStateTransitionError,
  type AuditActor,
} from "@/lib/trials/types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Trial ID is required.");

  const trial = TrialService.getById(id) || TrialService.getBySlug(id);
  if (!trial) return notFound(`Trial not found: ${id}`);

  const rawBody = (await request.json().catch(() => ({}))) as Record<string, unknown> | null;
  const expectedRevision =
    rawBody?.expected_revision !== undefined
      ? Number(rawBody.expected_revision)
      : trial.revision;

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
    user_agent: request.headers.get("user-agent") || null,
  };

  try {
    const updated = TrialService.archive(trial.id, expectedRevision, actor);
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
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Unable to archive trial.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
