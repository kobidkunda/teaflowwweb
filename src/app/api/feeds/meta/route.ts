import {
  isFeedAuthorized,
  feedUnauthorizedResponse,
  getFeedCatalogData,
  generateMetaCatalogCsv,
  getRequestOrigin,
  resolveBaseUrl,
} from "@/lib/feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request): Promise<Response> {
  if (!isFeedAuthorized(request)) {
    return feedUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const explicitBase = url.searchParams.get("base_url") || undefined;
  const originUrl = getRequestOrigin(request);
  const baseUrl = resolveBaseUrl(originUrl, { explicitOverride: explicitBase });
  const items = getFeedCatalogData(baseUrl);
  const csv = generateMetaCatalogCsv(items);

  const isDownload =
    url.searchParams.get("download") === "1" ||
    url.searchParams.get("download") === "true";

  const isTokenProtected = Boolean((process.env.FEED_ACCESS_TOKEN || "").trim());
  const cacheControl = isTokenProtected
    ? "private, no-cache, no-store, must-revalidate"
    : "public, max-age=3600, s-maxage=3600, stale-while-revalidate=600";

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": cacheControl,
      "Content-Disposition": isDownload
        ? 'attachment; filename="catalog-feed.csv"'
        : "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
