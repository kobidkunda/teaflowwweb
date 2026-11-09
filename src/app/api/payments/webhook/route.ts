import { NextResponse } from "next/server";
import { z } from "zod";
import { applyWebhook } from "@/lib/payments";

export const runtime = "nodejs";

const bodySchema = z.object({
  gatewayPaymentId: z.string().trim().min(1).max(200),
  status: z.string().trim().min(1).max(40),
  signature: z.string().trim().min(1).max(512),
  amountPaise: z.number().int().min(0).optional(),
});

/**
 * Gateway webhook entry. Deliberately unauthenticated at the HTTP layer: the
 * HMAC signature IS the authentication (server PAYMENT_WEBHOOK_SECRET, never
 * in the client bundle). Pre-signature failures return a generic 401 so the
 * endpoint is not an oracle for gateway configuration; post-signature
 * business outcomes return 200 with { ok } so gateways do not retry poison.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid webhook payload." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid webhook payload." }, { status: 400 });
  }
  const result = applyWebhook({
    gatewayPaymentId: parsed.data.gatewayPaymentId,
    status: parsed.data.status,
    signature: parsed.data.signature,
    amountPaise: parsed.data.amountPaise,
  });
  if (result.ok) return NextResponse.json(result);
  if (
    result.reason === "No payment gateway configured; webhook rejected." ||
    result.reason === "Invalid webhook signature."
  ) {
    return NextResponse.json({ ok: false, error: "Webhook rejected." }, { status: 401 });
  }
  return NextResponse.json(result);
}
