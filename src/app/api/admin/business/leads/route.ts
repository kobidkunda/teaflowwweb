import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/adminHttp";
import { listAdminB2BLeads } from "@/lib/business/repository";
import { LEAD_STATUSES, SEGMENTS, type BusinessLeadStatus, type Segment } from "@/lib/business/schema";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  const segParam = req.nextUrl.searchParams.get("segment");
  const statusParam = req.nextUrl.searchParams.get("status");
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? 100);

  const segment = SEGMENTS.includes(segParam as Segment) ? (segParam as Segment) : undefined;
  const status = LEAD_STATUSES.includes(statusParam as BusinessLeadStatus)
    ? (statusParam as BusinessLeadStatus)
    : undefined;

  return NextResponse.json({
    leads: listAdminB2BLeads({
      segment,
      status,
      limit: Number.isFinite(limitParam) ? limitParam : 100,
    }),
  });
}
