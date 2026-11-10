/**
 * Admin Private Label Studio — Production Jobs & Release Gate API
 *
 * GET  /api/v1/admin/private-label/jobs — Manufacturing pipeline tracker / status queue
 * POST /api/v1/admin/private-label/jobs — Release production job from deposit-paid order (enforces hard release gate)
 */

import { NextResponse } from "next/server";
import { guard, invalid, conflict, keyOf } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { idempotent } from "@/lib/adminStore";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  adminJobQuerySchema,
  adminReleaseJobSchema,
} from "@/lib/private-label/schemas";
import {
  PrivateLabelGateError,
  PrivateLabelNotFoundError,
  type AuditActor,
} from "@/lib/private-label/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const parsed = adminJobQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return invalid(parsed.error.flatten());
    }

    const result = PrivateLabelService.listProductionJobs(parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const rawBody: unknown = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const parsed = adminReleaseJobSchema.safeParse(rawBody);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
  };

  const idempotencyKey = keyOf(request, rawBody as { idempotencyKey?: string });

  try {
    const targetOrderId = parsed.data.orderId || parsed.data.order_id;
    if (!targetOrderId) {
      return invalid({ orderId: ["Order ID is required"] });
    }

    const { body: job, deduped } = idempotent("pl_job_release", idempotencyKey, () => {
      return PrivateLabelService.releaseProductionJob(
        targetOrderId,
        {
          target_completion_date: parsed.data.targetCompletionDate || parsed.data.target_completion_date,
          operator_notes: parsed.data.operatorNotes || parsed.data.operator_notes,
          operator_id: parsed.data.operatorId || parsed.data.operator_id,
          override_justification: parsed.data.overrideJustification || parsed.data.override_justification,
        },
        actor
      );
    });

    return NextResponse.json({ ...job, job, deduped }, { status: deduped ? 200 : 201 });
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
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Unable to release production job.";
    if (/sqlite|database|constraint|unique|foreign|syntax|table|column|abort/i.test(message)) {
      return conflict(message);
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
