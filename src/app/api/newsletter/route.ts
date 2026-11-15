import { newsletterSchema, saveNewsletterPreference } from "@/lib/newsletter";
import { getHomepageContent } from "@/lib/homepage";
import { rateLimitResponse } from "@/lib/rateLimit";
import { extractAttributionFromRequest } from "@/lib/funnel/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "newsletter", 10); if (limited) return limited;
  const origin = request.headers.get("origin");
  // Next's internal request URL can use the bind host (0.0.0.0). Compare the
  // browser's Origin with the incoming Host, never an untrusted forwarded host.
  if (origin) {
    try {
      const source = new URL(origin);
      if (!["http:", "https:"].includes(source.protocol) || source.host !== (request.headers.get("host") ?? new URL(request.url).host))
        return Response.json({ error: "Invalid request." }, { status: 403 });
    } catch { return Response.json({ error: "Invalid request." }, { status: 403 }); }
  }
  if (Number(request.headers.get("content-length") || 0) > 2048) return Response.json({ error: "Invalid request." }, { status: 413 });
  const raw = await request.text();
  if (raw.length > 2048) return Response.json({ error: "Invalid request." }, { status: 413 });
  let input: unknown; try { input = JSON.parse(raw); } catch { input = null; }
  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "Enter a valid email and agree to receive email news." }, { status: 400 });
  try {
    const settings = getHomepageContent()?.newsletter;
    if (!settings?.enabled) return Response.json({ error: "Newsletter signup is unavailable." }, { status: 503 });
    const attribution = extractAttributionFromRequest(request, input, "/");
    saveNewsletterPreference(parsed.data.email, settings.consent_label, attribution);
    if (attribution.marketingConsent) {
      import("@/lib/seo/metaCapi")
        .then(({ sendMetaServerFunnelEvent }) =>
          sendMetaServerFunnelEvent({
            eventName: "Lead",
            eventId: `newsletter_${Buffer.from(parsed.data.email).toString("hex").slice(0, 16)}`,
            marketingConsent: true,
            user: { email: parsed.data.email },
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
            customData: { content_name: "newsletter_signup" },
          })
        )
        .catch(() => {});
    }
    return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Unable to save your request. Please try again." }, { status: 503 }); }
}
