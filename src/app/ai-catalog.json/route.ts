import { NextResponse } from "next/server";
import catalog from "@/lib/seo/aiCatalog.json";
import { applySecurityHeaders } from "@/lib/security";

export const dynamic = "force-static";

export function GET() {
  const response = NextResponse.json(catalog, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });

  return applySecurityHeaders(response);
}
