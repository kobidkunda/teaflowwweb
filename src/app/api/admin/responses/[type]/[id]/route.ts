import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import {
  getAdminResponseDetail,
  RESPONSE_STATUSES,
  updateAdminResponseStatus,
} from "@/lib/admin/responses";
import { NOTIFICATION_EVENT_TYPES, type NotificationEventType } from "@/lib/notifications/events";

export const runtime = "nodejs";

function parseEntityType(raw: string): NotificationEventType | null {
  return (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(raw)
    ? (raw as NotificationEventType)
    : null;
}

const patchSchema = z.object({
  status: z.enum(RESPONSE_STATUSES),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { type, id } = await params;
  const entityType = parseEntityType(type);
  if (!entityType) return invalid({ type: "Unsupported response category." });

  try {
    const decodedId = decodeURIComponent(id);
    const detail = getAdminResponseDetail(entityType, decodedId);
    if (!detail.item) return notFound("Response record not found.");
    return NextResponse.json(detail);
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to load response details.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { type, id } = await params;
  const entityType = parseEntityType(type);
  if (!entityType) return invalid({ type: "Unsupported response category." });

  const body: unknown = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());

  try {
    const decodedId = decodeURIComponent(id);
    const admin = getAdminUser(request);
    updateAdminResponseStatus(entityType, decodedId, parsed.data.status, admin?.username || "admin");
    const detail = getAdminResponseDetail(entityType, decodedId);
    return NextResponse.json({ ok: true, ...detail });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to update status.");
  }
}
