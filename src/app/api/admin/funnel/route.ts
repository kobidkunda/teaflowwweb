import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/adminHttp";
import {
  getFunnelAnalytics,
  type BreakdownDimension,
  type TouchModel,
} from "@/lib/funnel/analytics";

export const runtime = "nodejs";

const querySchema = z.object({
  period: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
  funnel: z.string().trim().max(64).default("all"),
  touch: z.enum(["first", "last"]).default("last"),
  dimension: z
    .enum(["campaign", "source_medium", "keyword", "content", "landing_page", "funnel"])
    .default("campaign"),
  utm_source: z.string().trim().max(120).optional().default(""),
  utm_campaign: z.string().trim().max(150).optional().default(""),
  utm_term: z.string().trim().max(150).optional().default(""),
});

export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      period: searchParams.get("period") || "30d",
      funnel: searchParams.get("funnel") || "all",
      touch: searchParams.get("touch") || "last",
      dimension: searchParams.get("dimension") || "campaign",
      utm_source: searchParams.get("utm_source") || "",
      utm_campaign: searchParams.get("utm_campaign") || "",
      utm_term: searchParams.get("utm_term") || "",
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid funnel query parameters." }, { status: 400 });
    }

    const q = parsed.data;
    const data = getFunnelAnalytics({
      period: q.period,
      funnelName: q.funnel,
      touch: q.touch as TouchModel,
      dimension: q.dimension as BreakdownDimension,
      utmSource: q.utm_source || undefined,
      utmCampaign: q.utm_campaign || undefined,
      utmTerm: q.utm_term || undefined,
    });

    return NextResponse.json(
      { ok: true, ...data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to load funnel attribution analytics." },
      { status: 500 }
    );
  }
}
