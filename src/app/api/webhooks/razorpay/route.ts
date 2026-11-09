import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySignature } from "@/lib/international/providers";
import { paymentEventSchema } from "@/lib/international/orders";
import { readBoundedText } from "@/lib/international/http";
import { enqueue } from "@/lib/international/store";
import { getActiveRazorpayCredentials } from "@/lib/paymentSettings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let raw: string;
  try { raw = await readBoundedText(request); } catch { return NextResponse.json({ error: "Payload too large." }, { status: 413 }); }
  if (Buffer.byteLength(raw) > 128000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });

  const signature = request.headers.get("x-razorpay-signature") || "";
  const creds = getActiveRazorpayCredentials();
  const valid =
    verifySignature(raw, signature, creds.webhookSecret) ||
    verifySignature(raw, signature, process.env.RAZORPAY_WEBHOOK_SECRET || "") ||
    verifySignature(raw, signature, process.env.RAZORPAY_TEST_WEBHOOK_SECRET || "") ||
    verifySignature(raw, signature, process.env.RAZORPAY_PROD_WEBHOOK_SECRET || "");

  if (!valid) return NextResponse.json({ error: "Webhook rejected." }, { status: 401 });
  const id = z.string().min(1).max(200).safeParse(request.headers.get("x-razorpay-event-id"));
  if (!id.success) return NextResponse.json({ error: "Event identity required." }, { status: 400 });
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid payload." }, { status: 400 }); }
  const parsed = paymentEventSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ received: true, ignored: true });
  try {
    enqueue("payment_webhook", { eventId: id.data, payload: parsed.data }, `razorpay:${id.data}`);
    return NextResponse.json({ received: true });
  } catch { return NextResponse.json({ error: "Please retry delivery." }, { status: 503 }); }
}
