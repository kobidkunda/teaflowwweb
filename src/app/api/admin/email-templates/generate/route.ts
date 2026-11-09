import { NextResponse } from "next/server";
import { guard, invalid, conflict } from "@/lib/adminHttp";
import { emailGenerateSchema, generateEmailDraft } from "@/lib/emailTemplates";

export const runtime = "nodejs";

// POST /api/admin/email-templates/generate { goal, tone?, call_to_action?, logo_id?, template_key? }
// Deterministic prompt → draft generator (no external LLM, no new deps).
// Returns a subject/html_body/text_body draft the editor can apply.
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const body: unknown = await request.json().catch(() => null);
  const parsed = emailGenerateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  try {
    const draft = generateEmailDraft(parsed.data);
    return NextResponse.json({ ok: true, draft });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to generate email draft.");
  }
}
