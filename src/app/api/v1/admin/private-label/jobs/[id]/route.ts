/**
 * Admin Private Label Studio — Job Dossier & QC Milestones API
 *
 * GET   /api/v1/admin/private-label/jobs/:id — Job details with all 7 QC milestones
 * PATCH /api/v1/admin/private-label/jobs/:id — Update job status (enforces QC completion gate) or record milestone inspection
 */

import { NextResponse } from "next/server";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  adminUpdateJobSchema,
  qcMilestoneSchema,
} from "@/lib/private-label/schemas";
import {
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
  PrivateLabelRevisionConflictError,
  type AuditActor,
} from "@/lib/private-label/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Job ID is required.");

  try {
    const job = PrivateLabelService.getProductionJob(id);
    return NextResponse.json({ ...job, job }, { status: 200 });
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return notFound(error.message);
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Job ID is required.");

  const rawBody: Record<string, unknown> | null = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
  };

  try {
    // If updating a QC milestone
    if (rawBody.stage && rawBody.status && (rawBody.inspectorName || rawBody.inspector_name)) {
      const parsedMilestone = qcMilestoneSchema.safeParse({
        ...rawBody,
        jobId: id,
      });
      if (!parsedMilestone.success) {
        return invalid(parsedMilestone.error.flatten());
      }

      PrivateLabelService.recordQCMilestone(
        id,
        {
          milestone_name: parsedMilestone.data.milestoneName || parsedMilestone.data.milestone_name,
          stage: parsedMilestone.data.stage,
          status: parsedMilestone.data.status,
          inspector_name: parsedMilestone.data.inspectorName || parsedMilestone.data.inspector_name,
          evidence_notes: parsedMilestone.data.evidenceNotes || parsedMilestone.data.evidence_notes || parsedMilestone.data.notes,
          evidence_photo_url: parsedMilestone.data.evidencePhotoUrl || parsedMilestone.data.evidence_photo_url || parsedMilestone.data.evidence_url,
          cupping_score: parsedMilestone.data.cupping_score,
          recorded_weight_g: parsedMilestone.data.recorded_weight_g,
          target_weight_g: parsedMilestone.data.target_weight_g,
          notes: parsedMilestone.data.notes,
        },
        actor
      );

      const job = PrivateLabelService.getProductionJob(id);
      return NextResponse.json({ ...job, job }, { status: 200 });
    }

    // Otherwise updating job status or details
    const parsed = adminUpdateJobSchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalid(parsed.error.flatten());
    }

    if (parsed.data.status) {
      PrivateLabelService.updateJobStatus(
        id,
        parsed.data.status,
        actor,
        parsed.data.operator_notes
      );
    }

    if (parsed.data.target_completion_date !== undefined || parsed.data.actual_completion_date !== undefined) {
      PrivateLabelService.updateJobDetails(
        id,
        {
          target_completion_date: parsed.data.target_completion_date,
          actual_completion_date: parsed.data.actual_completion_date,
          operator_notes: parsed.data.operator_notes,
        },
        actor
      );
    }

    const job = PrivateLabelService.getProductionJob(id);
    return NextResponse.json({ ...job, job }, { status: 200 });
  } catch (error) {
    if (error instanceof PrivateLabelGateError) {
      return NextResponse.json(
        {
          error: error.message,
          gate_name: error.gate_name,
          blockers: error.blockers,
        },
        { status: 422 }
      );
    }
    if (error instanceof PrivateLabelNotFoundError) {
      return notFound(error.message);
    }
    if (error instanceof PrivateLabelRevisionConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          current_revision: error.current_revision,
          expected_revision: error.expected_revision,
        },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Unable to update job.";
    if (/sqlite|database|constraint|unique|foreign|syntax|table|column|abort/i.test(message)) {
      return conflict(message);
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
