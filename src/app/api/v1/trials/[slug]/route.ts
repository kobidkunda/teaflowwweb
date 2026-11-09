/**
 * Public Storefront Trial Detail API
 *
 * GET /api/v1/trials/:slug
 * Retrieves single published trial by slug with whitelisted public projection.
 * Draft and archived trials return HTTP 404 unless accessed with a verified admin session.
 */

import { NextResponse } from "next/server";
import { TrialService } from "@/lib/trials/service";
import { isAdminRequest } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug?.trim()) {
      return NextResponse.json({ error: "Trial slug is required." }, { status: 400 });
    }

    // Attempt to load published trial
    const publicTrial = TrialService.getPublicBySlug(slug);
    if (publicTrial) {
      return NextResponse.json(
        { ...publicTrial, trial: publicTrial },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          },
        }
      );
    }

    // Check for authenticated admin draft preview
    if (isAdminRequest(request)) {
      const full = TrialService.getBySlug(slug);
      if (full) {
        const previewDto = TrialService.toPublicDto(full, { allowDraftPreview: true });
        return NextResponse.json(
          { ...previewDto, trial: previewDto, is_preview: true },
          {
            status: 200,
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate",
            },
          }
        );
      }
    }

    return NextResponse.json(
      { error: `Trial not found: ${slug}` },
      { status: 404 }
    );
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
