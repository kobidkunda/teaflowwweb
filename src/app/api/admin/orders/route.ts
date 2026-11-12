import { NextResponse } from "next/server";
import { listOrdersPaginated } from "@/lib/orders";
import { guard } from "@/lib/adminHttp";
export const runtime = "nodejs";
export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get("pageSize") || url.searchParams.get("limit") || "20", 10) || 20, 1), 100);
  const paymentStatus = url.searchParams.get("paymentStatus") || undefined;
  const dispatchStatus = url.searchParams.get("dispatchStatus") || undefined;
  const q = (url.searchParams.get("q") || "").slice(0, 60) || undefined;
  const cursor = url.searchParams.get("cursor") || undefined;

  const result = listOrdersPaginated({
    paymentStatus,
    dispatchStatus,
    q,
    cursor,
    page,
    pageSize,
  });

  // PII stays behind the token gate; list rows omit address for the overview.
  return NextResponse.json({
    orders: result.orders.map((o) => {
      const copy = { ...o } as Record<string, unknown>;
      delete copy.shipping_address;
      return copy;
    }),
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
}
