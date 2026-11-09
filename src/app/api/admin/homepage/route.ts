import { NextResponse } from "next/server";
import { guard, invalid } from "@/lib/adminHttp";
import { getHomepageContent, saveHomepageContent } from "@/lib/homepage";
import { HOME_TRIAL_MEDIA_GUIDANCE } from "@/lib/homeTrialsPresentation";
import { homepageSchema } from "@/lib/homepageSchema";
export const runtime = "nodejs";
export function GET(request: Request) {
  const denied = guard(request); if (denied) return denied;
  return NextResponse.json({ content: getHomepageContent(), media_guidance: { trials: HOME_TRIAL_MEDIA_GUIDANCE } });
}
export async function PUT(request: Request) {
  const denied = guard(request); if (denied) return denied;
  const parsed = homepageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten());
  try { return NextResponse.json({ content: saveHomepageContent(parsed.data), media_guidance: { trials: HOME_TRIAL_MEDIA_GUIDANCE } }); }
  catch { return NextResponse.json({ error: "Unable to save homepage content. Please try again." }, { status: 500 }); }
}
