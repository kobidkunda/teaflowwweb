import { NextResponse } from "next/server";
import { readBoundedText } from "@/lib/international/http";
import { getActiveYoupiClient } from "@/lib/youpi/config";
import { applyYoupiPaymentEvent } from "@/lib/international/orders";
import type { YoupiWebhookEvent } from "@/lib/youpi/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let raw: string;
  try {
    raw = await readBoundedText(request);
  } catch {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  if (Buffer.byteLength(raw) > 128000) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const signature = request.headers.get("x-gateway-signature") || "";
  const timestampHeader = request.headers.get("x-gateway-timestamp");
  const deliveryIdHeader = request.headers.get("x-gateway-delivery-id");

  const youpiClient = getActiveYoupiClient();

  let event: YoupiWebhookEvent;
  try {
    event = youpiClient.verifyWebhook(raw, signature, undefined, {
      timestampHeader,
      deliveryIdHeader,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error)?.message || "Webhook signature verification failed." },
      { status: 401 }
    );
  }

  if (!event || !event.orderId || !event.event) {
    return NextResponse.json({ error: "Invalid webhook payload structure." }, { status: 400 });
  }

  try {
    const deliveryId = deliveryIdHeader || event.deliveryId || event.paymentId;
    applyYoupiPaymentEvent(deliveryId, event);
    return NextResponse.json({ received: true, event: event.event, orderId: event.orderId });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error)?.message || "Failed to process webhook event." },
      { status: 500 }
    );
  }
}
