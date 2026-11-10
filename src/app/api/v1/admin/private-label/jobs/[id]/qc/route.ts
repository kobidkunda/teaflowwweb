import { NextResponse } from "next/server";
import { guard, invalid, notFound } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { PrivateLabelService } from "@/lib/private-label/service";
import { qcMilestoneSchema } from "@/lib/private-label/schemas";
import {
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
  type AuditActor,
} from "@/lib/private-label/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const unauthorized = guard(request);
  if (unauthorized) return unauthorized;

  const { id } = await props.params;

  try {
    const jobWithMilestones = PrivateLabelService.getProductionJob(id);
    return NextResponse.json(
      {
        job_id: id,
        milestones: jobWithMilestones.milestones,
        stages: jobWithMilestones.milestones,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return notFound(`ProductionJob '${id}' not found`);
    }
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const unauthorized = guard(request);
  if (unauthorized) return unauthorized;

  const { id } = await props.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid({ body: ["Invalid JSON"] });
  }

  const rawData =
    body && typeof body === "object" && "data" in body && typeof (body as Record<string, unknown>).data === "object"
      ? ((body as Record<string, unknown>).data as Record<string, unknown>)
      : (body as Record<string, unknown>);

  const parseResult = qcMilestoneSchema.safeParse({
    ...rawData,
    jobId: id,
  });

  if (!parseResult.success) {
    return invalid(parseResult.error.flatten());
  }

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
  };

  try {
    const milestone = PrivateLabelService.recordQCMilestone(
      id,
      {
        milestone_name: parseResult.data.milestoneName || parseResult.data.milestone_name,
        stage: parseResult.data.stage,
        status: parseResult.data.status,
        inspector_name: parseResult.data.inspectorName || parseResult.data.inspector_name,
        evidence_notes: parseResult.data.evidenceNotes || parseResult.data.evidence_notes || parseResult.data.notes,
        evidence_photo_url: parseResult.data.evidencePhotoUrl || parseResult.data.evidence_photo_url || parseResult.data.evidence_url,
        cupping_score: parseResult.data.cupping_score,
        recorded_weight_g: parseResult.data.recorded_weight_g,
        target_weight_g: parseResult.data.target_weight_g,
        notes: parseResult.data.notes,
      },
      actor
    );

    const updatedJob = PrivateLabelService.getProductionJob(id);

    return NextResponse.json(
      {
        milestone,
        job: updatedJob,
        status: milestone.status,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return notFound(`ProductionJob '${id}' not found`);
    }
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
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
