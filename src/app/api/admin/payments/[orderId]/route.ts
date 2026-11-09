import { NextResponse } from "next/server";
import { z } from "zod";
import { recordPaymentIntent, listPayments, PaymentError } from "@/lib/payments";
import { guard, invalid, conflict } from "@/lib/adminHttp";
export const runtime = "nodejs";
// Status records only (demo checkout idempotent). Nothing here marks an order paid.
export function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  return params.then(({ orderId }) => NextResponse.json({ payments: listPayments(decodeURIComponent(orderId)) }));
}
const bodySchema = z.object({
  amountPaise: z.number().int().min(0),
  idempotencyKey: z.string().uuid(),
  gateway: z.string().trim().min(1).max(40).optional(),
  gatewayPaymentId: z.string().trim().min(1).max(200).optional(),
});
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { orderId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  try {
    const { payment, deduped } = recordPaymentIntent(decodeURIComponent(orderId), parsed.data.amountPaise, parsed.data.idempotencyKey, parsed.data.gateway ?? "demo", parsed.data.gatewayPaymentId ?? null);
    return NextResponse.json({ payment, deduped }, { status: deduped ? 200 : 201 });
  } catch (e) {
    if (e instanceof PaymentError) return /not found/i.test(e.message) ? NextResponse.json({ error: "Order not found." }, { status: 404 }) : conflict(e.message);
    return conflict("Unable to record the payment.");
  }
}
