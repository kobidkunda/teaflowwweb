/**
 * Admin Private Label Studio — Overview Dashboard Stats API
 *
 * GET /api/v1/admin/private-label/overview — Real-time KPI counts, pipeline status, and recent audit activity
 */

import { NextResponse } from "next/server";
import { guard } from "@/lib/adminHttp";
import { PrivateLabelService } from "@/lib/private-label/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const stats = PrivateLabelService.getAdminOverviewStats();
    return NextResponse.json({ ...stats, stats, success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
