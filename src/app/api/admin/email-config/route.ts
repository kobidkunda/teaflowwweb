import { NextResponse } from "next/server";
import { guard, conflict } from "@/lib/adminHttp";
import { getSmtpStatus } from "@/lib/email";
import { listLogoOptions } from "@/lib/emailTemplates";

export const runtime = "nodejs";

// GET /api/admin/email-config → redacted SMTP status (same conf MCP reports)
// plus brand logo references for the template editor.
// Never exposes SMTP_USER / SMTP_PASS values.
export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ smtp: getSmtpStatus(), logos: listLogoOptions() });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to read email configuration.");
  }
}
