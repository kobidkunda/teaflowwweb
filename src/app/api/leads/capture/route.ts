import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rateLimit";
import { leadCaptureSchema, captureLead } from "@/lib/leads";
import { extractAttributionFromRequest } from "@/lib/funnel/server";

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

  // 3. Capture lead and link to cart / fingerprint / funnel attribution
  try {
    const resolvedAttribution = extractAttributionFromRequest(request, body);
    const result = captureLead({
      sessionId: parsed.data.sessionId,
      phoneNumber: parsed.data.phoneNumber,
      customerName: parsed.data.customerName,
      cartId: parsed.data.cartId,
      source: parsed.data.source,
      attribution: parsed.data.attribution,
      resolvedAttribution,
    });

    if (resolvedAttribution.marketingConsent) {
      import("@/lib/seo/metaCapi")
        .then(({ sendMetaServerFunnelEvent }) =>
          sendMetaServerFunnelEvent({
            eventName: "Lead",
            eventId: `lead_${result.leadId}`,
            marketingConsent: true,
            user: {
              phone: parsed.data.phoneNumber,
              name: parsed.data.customerName,
            },
            attribution: {
              fbc: resolvedAttribution.fbc,
              fbp: resolvedAttribution.fbp,
              clientIp: resolvedAttribution.clientIp,
              userAgent: resolvedAttribution.userAgent,
              sourceUrl: resolvedAttribution.referer || undefined,
              utmSource: resolvedAttribution.lastTouch.utm_source,
              utmMedium: resolvedAttribution.lastTouch.utm_medium,
              utmCampaign: resolvedAttribution.lastTouch.utm_campaign,
              utmTerm: resolvedAttribution.lastTouch.utm_term,
              utmContent: resolvedAttribution.lastTouch.utm_content,
              funnelName: resolvedAttribution.funnelName,
            },
            customData: { content_name: parsed.data.source },
          })
        )
        .catch(() => {});
    }

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
