import { NextResponse } from "next/server";
import { listAbandonedCarts } from "@/lib/abandonedCarts";
import { guard } from "@/lib/adminHttp";

export const runtime = "nodejs";

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const hasPhoneParam = url.searchParams.get("has_phone");
  const hasPhone = hasPhoneParam === "true" ? true : undefined;
  const search = url.searchParams.get("q") || url.searchParams.get("search") || undefined;
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);

  const result = listAbandonedCarts({
    status,
    has_phone: hasPhone,
    search,
    limit,
    offset,
  });

  return NextResponse.json(result);
}
