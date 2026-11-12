import { NextResponse } from "next/server";
import { cancelOrder, OrderTransitionError } from "@/lib/orders";
import { guard, notFound, conflict } from "@/lib/adminHttp";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    return NextResponse.json({ order: cancelOrder(decodeURIComponent(id)) });
  } catch (e) {
    if (e instanceof OrderTransitionError) {
      return /not found/i.test(e.message) ? notFound("Order not found.") : conflict(e.message);
    }
    const msg = e instanceof Error ? e.message : "Unable to cancel the order.";
    return conflict(msg);
  }
}
