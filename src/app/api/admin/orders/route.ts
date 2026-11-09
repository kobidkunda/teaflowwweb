import { NextResponse } from "next/server";
import { listOrders } from "@/lib/orders";
import { guard } from "@/lib/adminHttp";
export const runtime = "nodejs";
export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const orders = listOrders({
    paymentStatus: url.searchParams.get("paymentStatus") || undefined,
    dispatchStatus: url.searchParams.get("dispatchStatus") || undefined,
    q: (url.searchParams.get("q") || "").slice(0, 60) || undefined,
    limit: Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1), 100),
    cursor: url.searchParams.get("cursor") || undefined,
  });
  // PII stays behind the token gate; list rows omit address for the overview.
  return NextResponse.json({ orders: orders.map((o) => {
    const copy = { ...o } as Record<string, unknown>;
    delete copy.shipping_address;
    return copy;
  }) });
}
