import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
import { getEmailTemplate, renderEmailTemplate } from "@/lib/emailTemplates";
import { getSmtpStatus, sendMailHtml } from "@/lib/email";

export const runtime = "nodejs";

const testSchema = z.object({
  to: z.string().trim().email("Enter a valid test recipient email").max(254),
  vars: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

// POST /api/admin/email-templates/:key/test { to, vars? }
// Sends the rendered template through the configured SMTP relay (same conf
// the MCP email.sendTest tool uses). Never leaks SMTP secrets.
export async function POST(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { key } = await ctx.params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  try {
    const template = getEmailTemplate(decodeURIComponent(key));
    if (!template) return notFound("Email template not found.");
    const smtp = getSmtpStatus();
    if (!smtp.configured) {
      return NextResponse.json({
        ok: false,
        sent: false,
        reason: "SMTP is not configured. Set SMTP_HOST (plus SMTP_USER/SMTP_PASS and RESET_FROM_EMAIL) and retry.",
        smtp,
        preview: renderEmailTemplate(template, parsed.data.vars ?? {}),
      });
    }
    const rendered = renderEmailTemplate(template, parsed.data.vars ?? {});
    const result = await sendMailHtml({
      to: parsed.data.to,
      subject: "[TEST] " + rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
    return NextResponse.json({
      ok: result.sent,
      sent: result.sent,
      reason: result.sent ? "Test email sent via the configured SMTP relay." : "SMTP relay rejected the message; check host credentials.",
      smtp,
    });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to send test email.");
  }
}
