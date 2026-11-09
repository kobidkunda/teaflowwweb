/**
 * Public Storefront Trials Catalogue API
 *
 * GET /api/v1/trials
 * Whitelist-based projection of published trial assortment kits.
 * Redacts internal COGS, supplier information, and unpublished records.
 */

import { NextResponse } from "next/server";
import { TrialService } from "@/lib/trials/service";
import { trialPublicQuerySchema } from "@/lib/trials/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const offsetRaw = url.searchParams.get("offset");
    const pageRaw = url.searchParams.get("page");
    const searchRaw = url.searchParams.get("search") || url.searchParams.get("q");
    const sortByRaw = url.searchParams.get("sort_by");
    const sortDirRaw = url.searchParams.get("sort_dir");

    const limit = limitRaw ? parseInt(limitRaw, 10) : 12;
    let offset = offsetRaw ? parseInt(offsetRaw, 10) : 0;
    if (!offsetRaw && pageRaw) {
      const pageNum = Math.max(parseInt(pageRaw, 10) || 1, 1);
      offset = (pageNum - 1) * limit;
    }

    const queryInput = {
      search: searchRaw?.trim() || undefined,
      limit,
      offset,
      sort_by: sortByRaw || undefined,
      sort_dir: sortDirRaw || undefined,
    };

    const parsed = trialPublicQuerySchema.safeParse(queryInput);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = TrialService.listPublic(parsed.data);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
