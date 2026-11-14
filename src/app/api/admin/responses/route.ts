import { NextResponse } from "next/server";
import { guard, conflict } from "@/lib/adminHttp";
import { listAdminResponses } from "@/lib/admin/responses";
import { NOTIFICATION_EVENT_TYPES, type NotificationEventType } from "@/lib/notifications/events";

export const runtime = "nodejs";

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const rawType = url.searchParams.get("type") || "all";
    const type: NotificationEventType | "all" =
      rawType !== "all" && (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(rawType)
        ? (rawType as NotificationEventType)
        : "all";
    const status = url.searchParams.get("status") || "all";
    const q = url.searchParams.get("q") || "";
    const limit = Number(url.searchParams.get("limit") || 50);
    const offset = Number(url.searchParams.get("offset") || 0);

    const result = listAdminResponses({ type, status, q, limit, offset });
    return NextResponse.json(result);
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to load admin responses.");
  }
}
