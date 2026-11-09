import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rateLimit";
import { leadCaptureSchema, captureLead } from "@/lib/leads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // 1. Rate limiting: 30 requests/minute per client
  const limited = rateLimitResponse(request, "lead_capture", 30);
  if (limited) return limited;

  // 2. Parse & validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = leadCaptureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // 3. Capture lead and link to cart / fingerprint
  try {
    const result = captureLead({
      sessionId: parsed.data.sessionId,
      phoneNumber: parsed.data.phoneNumber,
      customerName: parsed.data.customerName,
      cartId: parsed.data.cartId,
      source: parsed.data.source,
    });

    return NextResponse.json({
      success: true,
      couponCode: result.couponCode,
      discountPercent: result.discountPercent,
      message: result.message,
      cartId: result.cartId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    const isValidation = message.includes("Invalid phone number");
    if (isValidation) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    // Return sanitized error without exposing raw database errors
    return NextResponse.json({ error: "Unable to capture lead." }, { status: 500 });
  }
}
