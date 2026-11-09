import { NextResponse } from "next/server";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
import { getEmailTemplate, updateEmailTemplate, emailTemplateSchema, renderEmailTemplate } from "@/lib/emailTemplates";

export const runtime = "nodejs";

// GET /api/admin/email-templates/:key → { template, preview }
export function GET(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  return ctx.params.then(({ key }) => {
    const template = getEmailTemplate(decodeURIComponent(key));
    if (!template) return notFound("Email template not found.");
    const url = new URL(request.url);
    // Optional ?preview=1 renders with sample vars for the editor preview pane.
    if (url.searchParams.get("preview") === "1") {
      const sample = sampleVarsFor(template.key);
      return NextResponse.json({ template, preview: renderEmailTemplate(template, sample) });
    }
    return NextResponse.json({ template });
  });
}

// PUT /api/admin/email-templates/:key { subject, html_body, text_body }
export async function PUT(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { key } = await ctx.params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = emailTemplateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  try {
    const template = updateEmailTemplate(decodeURIComponent(key), parsed.data);
    return NextResponse.json({ ok: true, template });
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return notFound("Email template not found.");
    return conflict(e instanceof Error ? e.message : "Unable to save email template.");
  }
}

function sampleVarsFor(key: string): Record<string, string> {
  const base: Record<string, string> = {
    store_name: "TeaFloww",
    support_email: "info@teafloww.com",
    logo_url: "https://teafloww.com/logo/png/08_light_forest_green.png",
    customer_name: "Aarav Sharma",
    order_id: "TF-2026-000123",
    order_total: "₹499",
    tracking_url: "https://teafloww.com/track?order=TF-2026-000123",
    reset_link: "https://teafloww.com/admin/reset?token=sample-token",
    reference_code: "TF-CNT-ABC123",
    topic: "Brewing Guidance",
    business_name: "Himalayan Retreat, Gangtok",
    recovery_url: "https://teafloww.com/cart?recover=sample-token",
  };
  void key;
  return base;
}
