import { newsletterSchema, saveNewsletterPreference } from "@/lib/newsletter";
import { getHomepageContent } from "@/lib/homepage";
import { rateLimitResponse } from "@/lib/rateLimit";
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
    saveNewsletterPreference(parsed.data.email, settings.consent_label);
    return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Unable to save your request. Please try again." }, { status: 503 }); }
}
