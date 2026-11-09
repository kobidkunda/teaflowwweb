/**
 * Admin Trial Publication API
 *
 * POST /api/v1/admin/trials/:id/publish
 * Evaluates publication blocker gates and transitions state to 'published'.
 * Creates immutable snapshot in trial_publications and increments revision.
 * Rejects publication with HTTP 422 if blockers exist.
 */

import { NextResponse } from "next/server";
import { guard, notFound } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { TrialService } from "@/lib/trials/service";
import {
  TrialPublishGateError,
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
    const published = TrialService.publish(trial.id, expectedRevision, actor);
    return NextResponse.json({ ...published, trial: published }, { status: 200 });
  } catch (error) {
    if (error instanceof TrialPublishGateError) {
      return NextResponse.json(
        {
          error: error.message,
          blockers: error.blockers,
        },
        { status: 422 }
      );
    }
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
    const message = error instanceof Error ? error.message : "Unable to publish trial.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
