/**
 * Admin Sachet Components Replacement API
 *
 * PUT / POST /api/v1/admin/trials/:id/components
 * Atomically replaces all kit components while enforcing:
 * 1. 4x50g = 200g net weight invariant
 * 2. CAS optimistic revision concurrency control
 * 3. In-transaction atomic replacement and audit trail
 */

import { NextResponse } from "next/server";
import { guard, invalid, notFound } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { TrialService } from "@/lib/trials/service";
import { replaceComponentsSchema } from "@/lib/trials/validation";
import {
  TrialRevisionConflictError,
  TrialWeightInvariantError,
  TrialNotFoundError,
  TrialInvalidStateTransitionError,
  type AuditActor,
} from "@/lib/trials/types";

export const runtime = "nodejs";

async function handleReplaceComponents(
  request: Request,
  params: Promise<{ id: string }>
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Trial ID is required.");

  const trial = TrialService.getById(id) || TrialService.getBySlug(id);
  if (!trial) return notFound(`Trial not found: ${id}`);

  const rawBody: unknown = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const parsed = replaceComponentsSchema.safeParse(rawBody);
  if (!parsed.success) {
    const isWeightInvariantIssue = parsed.error.issues.some(
      (iss) =>
        iss.message.includes("invariant") ||
        iss.message.includes("200g") ||
        iss.message.includes("sachets") ||
        iss.message.includes("50g")
    );
    if (isWeightInvariantIssue) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || "Weight invariant violation.",
          details: parsed.error.flatten(),
        },
        { status: 422 }
      );
    }
    return invalid(parsed.error.flatten());
  }

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
    user_agent: request.headers.get("user-agent") || null,
  };

  try {
    const updated = TrialService.replaceComponents(
      trial.id,
      parsed.data.expected_revision,
      parsed.data.components,
      actor
    );
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
    if (error instanceof TrialWeightInvariantError) {
      return NextResponse.json(
        {
          error: error.message,
          totalWeight: error.totalWeight,
          count: error.count,
        },
        { status: 422 }
      );
    }
    if (error instanceof TrialNotFoundError) {
      return notFound(error.message);
    }
    if (error instanceof TrialInvalidStateTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Unable to replace components.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleReplaceComponents(request, params);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleReplaceComponents(request, params);
}
