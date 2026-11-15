import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rateLimit";
import { contactInquirySchema, recordContactInquiry } from "@/lib/contact";
import { extractAttributionFromRequest } from "@/lib/funnel/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // 1. Rate limiting: 15 submissions per minute per client IP
  const limited = rateLimitResponse(request, "contact_inquiry", 15);
  if (limited) return limited;

  // 2. Parse & validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const parsed = contactInquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Validation failed. Please verify the highlighted fields.",
        issues: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  // 3. Extract request metadata
  const userAgent = request.headers.get("user-agent") || undefined;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

  try {
    const attribution = extractAttributionFromRequest(request, body, "/contact");
    const result = recordContactInquiry(parsed.data, {
      ip_hash: ip,
      user_agent: userAgent,
      attribution,
    });

    if (attribution.marketingConsent) {
      import("@/lib/seo/metaCapi")
        .then(({ sendMetaServerFunnelEvent }) =>
          sendMetaServerFunnelEvent({
            eventName: "Lead",
            eventId: `contact_${result.referenceCode}`,
            marketingConsent: true,
            user: {
              email: parsed.data.email,
              phone: parsed.data.phone,
              name: parsed.data.name,
            },
            attribution: {
              fbc: attribution.fbc,
              fbp: attribution.fbp,
              clientIp: attribution.clientIp,
              userAgent: attribution.userAgent,
              sourceUrl: attribution.referer || undefined,
              utmSource: attribution.lastTouch.utm_source,
              utmMedium: attribution.lastTouch.utm_medium,
              utmCampaign: attribution.lastTouch.utm_campaign,
              utmTerm: attribution.lastTouch.utm_term,
              utmContent: attribution.lastTouch.utm_content,
              funnelName: attribution.funnelName,
            },
            customData: { content_name: `contact_${parsed.data.topic}` },
          })
        )
        .catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      referenceCode: result.referenceCode,
      whatsappUrl: result.whatsappUrl,
      message:
        "Your message has reached our Siliguri tea house team. A sommelier or support specialist will respond within 24 hours.",
    });
  } catch {
    // Never expose raw database errors to client
    return NextResponse.json(
      {
        ok: false,
        error: "We could not submit your message at this moment. Please reach out via WhatsApp or email directly.",
      },
      { status: 500 }
    );
  }
}
