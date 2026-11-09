import { NextResponse } from "next/server";
import { listSliders, upsertSlider } from "@/lib/sliders";
import { sliderSchema } from "@/lib/validation";
import { guard, invalid, conflict, keyOf } from "@/lib/adminHttp";
export const runtime = "nodejs";
export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;
  const pageTarget = url.searchParams.get("page_target") || url.searchParams.get("pageTarget") || undefined;
  const categorySlug = url.searchParams.get("category_slug") || url.searchParams.get("categorySlug") || undefined;
  return NextResponse.json({ sliders: listSliders({ limit, pageTarget, categorySlug }) });
}
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const body: unknown = await request.json().catch(() => null);
  const parsed = sliderSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  try {
    const result = upsertSlider({ ...parsed.data, idempotencyKey: keyOf(request, parsed.data) });
    return NextResponse.json(result, { status: result.deduped ? 200 : 201 });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to save the slider.");
  }
}
