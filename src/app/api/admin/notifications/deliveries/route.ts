import { NextResponse } from "next/server";
import { guard, conflict } from "@/lib/adminHttp";
import { listRecentDeliveries } from "@/lib/notifications/deliveries";

export const runtime = "nodejs";

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const deliveries = listRecentDeliveries(30);
    return NextResponse.json({ deliveries });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to load notification deliveries.");
  }
}
