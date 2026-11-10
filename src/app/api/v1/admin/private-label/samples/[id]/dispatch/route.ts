import { NextResponse } from "next/server";
import { guard, invalid, notFound } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { PrivateLabelService } from "@/lib/private-label/service";
import { adminDispatchSampleSchema } from "@/lib/private-label/schemas";
import {
  PrivateLabelNotFoundError,
  type AuditActor,
} from "@/lib/private-label/types";

export const runtime = "nodejs";

export async function PATCH(
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

  const parseResult = adminDispatchSampleSchema.safeParse(rawData);
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
    const updated = PrivateLabelService.dispatchSampleOrder(id, parseResult.data, actor);
    return NextResponse.json({ sample: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return notFound(`SampleOrder '${id}' not found`);
    }
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
