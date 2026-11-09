import { NextResponse } from "next/server";
import { setDispatchStatusTx, cancelOrder, OrderTransitionError } from "@/lib/orders";
import { dispatchSchema } from "@/lib/validation";
import { guard, invalid, notFound, conflict, keyOf } from "@/lib/adminHttp";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = dispatchSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  try {
    const { order, deduped } = setDispatchStatusTx({
      orderId: decodeURIComponent(id), to: parsed.data.to, idempotencyKey: keyOf(request, parsed.data),
    });
    return NextResponse.json({ order, deduped });
  } catch (e) {
    if (e instanceof OrderTransitionError) {
      return /not found/i.test(e.message) ? notFound("Order not found.") : conflict(e.message);
    }
    return conflict("Unable to update dispatch status.");
  }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    return NextResponse.json({ order: cancelOrder(decodeURIComponent(id)) });
  } catch (e) {
    if (e instanceof OrderTransitionError) {
      return /not found/i.test(e.message) ? notFound("Order not found.") : conflict(e.message);
    }
    return conflict("Unable to cancel the order.");
  }
}
