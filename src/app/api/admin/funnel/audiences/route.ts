import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/adminHttp";
import {
  exportRemarketingCsv,
  queryRemarketingAudience,
  type AudienceExportFormat,
  type RemarketingSegment,
} from "@/lib/funnel/analytics";

export const runtime = "nodejs";

const segmentEnum = z.enum([
  "abandoned_carts_unconverted",
  "leads_unconverted",
  "whatsapp_no_order",
  "b2b_wholesale_prospects",
  "all_purchasers",
  "high_value_repeat_buyers",
  "newsletter_non_buyers",
]);

const formatEnum = z.enum(["meta_hashed", "google_customer_match", "crm_plain"]);

const filterSchema = z.object({
  segment: segmentEnum.default("abandoned_carts_unconverted"),
  period: z.enum(["7d", "30d", "90d", "all"]).default("90d"),
  utmSource: z.string().trim().max(120).optional().default(""),
  utmCampaign: z.string().trim().max(150).optional().default(""),
  utmTerm: z.string().trim().max(150).optional().default(""),
  funnelName: z.string().trim().max(64).optional().default("all"),
});

export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = filterSchema.safeParse({
      segment: searchParams.get("segment") || "abandoned_carts_unconverted",
      period: searchParams.get("period") || "90d",
      utmSource: searchParams.get("utm_source") || "",
      utmCampaign: searchParams.get("utm_campaign") || "",
      utmTerm: searchParams.get("utm_term") || "",
      funnelName: searchParams.get("funnel") || "all",
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid remarketing filter." }, { status: 400 });
    }

    const q = parsed.data;
    const result = queryRemarketingAudience({
      segment: q.segment as RemarketingSegment,
      period: q.period,
      utmSource: q.utmSource || undefined,
      utmCampaign: q.utmCampaign || undefined,
      utmTerm: q.utmTerm || undefined,
      funnelName: q.funnelName,
    });

    return NextResponse.json(
      { ok: true, segment: result.segment, records: result.records, total: result.totalMatched },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to query remarketing audience." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const body: unknown = await request.json().catch(() => null);
    const parsed = filterSchema
      .extend({ format: formatEnum.default("meta_hashed") })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid export request." }, { status: 400 });
    }

    const q = parsed.data;
    const { filename, csv, count } = exportRemarketingCsv(
      {
        segment: q.segment as RemarketingSegment,
        period: q.period,
        utmSource: q.utmSource || undefined,
        utmCampaign: q.utmCampaign || undefined,
        utmTerm: q.utmTerm || undefined,
        funnelName: q.funnelName,
      },
      q.format as AudienceExportFormat
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Audience-Count": String(count),
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to generate remarketing CSV export." },
      { status: 500 }
    );
  }
}
