import { NextResponse } from "next/server";
import { guard, conflict } from "@/lib/adminHttp";
import { listEmailTemplates } from "@/lib/emailTemplates";

export const runtime = "nodejs";

// GET /api/admin/email-templates → { templates }
export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ templates: listEmailTemplates() });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to list email templates.");
  }
}
