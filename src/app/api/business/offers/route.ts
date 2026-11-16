import { NextRequest, NextResponse } from "next/server";
import { listPublicB2BOffers } from "@/lib/business/repository";
import type { BusinessLocale } from "@/lib/business/schema";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const langParam = request.nextUrl.searchParams.get("lang");
  const locale: BusinessLocale = langParam === "hi" ? "hi" : "en";
  const offers = listPublicB2BOffers(locale);

  return NextResponse.json(
    {
      offers,
      locale,
      lastVerifiedAt: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    }
  );
}
