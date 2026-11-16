import { NextRequest, NextResponse } from "next/server";
import {
  getB2BPageContent,
  getB2BSettings,
  listPublicB2BClaims,
  listPublicB2BOffers,
} from "@/lib/business/repository";
import type { BusinessLocale, Segment } from "@/lib/business/schema";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const segmentParam = request.nextUrl.searchParams.get("segment");
  const langParam = request.nextUrl.searchParams.get("lang");
  const segment: Segment = segmentParam === "trader" ? "trader" : "starter";
  const locale: BusinessLocale = langParam === "hi" ? "hi" : "en";

  const settings = getB2BSettings();
  const pageContent = getB2BPageContent(segment, locale);
  const offers = listPublicB2BOffers(locale);
  const claims = listPublicB2BClaims("web");

  return NextResponse.json(
    {
      segment,
      locale,
      landingEnabled: settings.business_landing_enabled,
      leadsEnabled: settings.leads_enabled,
      whatsappEnabled: settings.whatsapp_enabled,
      whatsappE164: settings.whatsapp_enabled ? settings.whatsapp_e164 : null,
      supportHours: settings.support_hours,
      pageContent,
      offers,
      claims,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    }
  );
}
