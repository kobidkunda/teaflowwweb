import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import {
  getSitePlacement,
  listSitePlacements,
  upsertSitePlacement,
  deleteSitePlacement,
} from "@/lib/media";

export const runtime = "nodejs";

const upsertSchema = z.object({
  section_key: z.string().min(1).max(80),
  image_url: z.string().max(500).optional(),
  alt_text: z.string().max(300).optional(),
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  cta_label: z.string().max(100).optional(),
  cta_href: z.string().max(300).optional(),
  media_id: z.number().int().positive().optional().nullable(),
});

/** GET /api/admin/placements?key=section_key — fetch one or list all */
export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (key) {
    const placement = getSitePlacement(key);
    return NextResponse.json({ placement: placement ?? null });
  }

  const placements = listSitePlacements();
  return NextResponse.json({ placements });
}

/** PUT /api/admin/placements — upsert a site placement */
export async function PUT(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());

  try {
    const placement = upsertSitePlacement(parsed.data);
    return NextResponse.json({ placement });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Could not save placement.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/admin/placements?key=section_key */
export async function DELETE(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing ?key= parameter." }, { status: 400 });
  }

  const deleted = deleteSitePlacement(key);
  return NextResponse.json({ deleted });
}
