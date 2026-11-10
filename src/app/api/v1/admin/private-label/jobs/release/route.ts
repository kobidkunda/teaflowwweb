import { NextResponse } from "next/server";
import { guard, invalid, notFound } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { PrivateLabelService } from "@/lib/private-label/service";
import { adminReleaseJobSchema } from "@/lib/private-label/schemas";
import {
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
  type AuditActor,
} from "@/lib/private-label/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = guard(request);
  if (unauthorized) return unauthorized;

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

  const parseResult = adminReleaseJobSchema.safeParse(rawData);
  if (!parseResult.success) {
    return invalid(parseResult.error.flatten());
  }

  const orderId = parseResult.data.orderId || parseResult.data.order_id;
  if (!orderId) {
    return invalid({ orderId: ["Order ID is required"] });
  }

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
  };

  try {
    const job = PrivateLabelService.releaseProductionJob(
      orderId,
      {
        target_completion_date: parseResult.data.targetCompletionDate || parseResult.data.target_completion_date,
        operator_notes: parseResult.data.operatorNotes || parseResult.data.operator_notes,
        operator_id: parseResult.data.operatorId || parseResult.data.operator_id,
        override_justification: parseResult.data.overrideJustification || parseResult.data.override_justification,
      },
      actor
    );

    return NextResponse.json({ job, id: job.id, job_number: job.job_number }, { status: 201 });
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return notFound(`Order '${orderId}' not found`);
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
