import {
  isFeedAuthorized,
  feedUnauthorizedResponse,
  getFeedCatalogData,
  generateGoogleMerchantXml,
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
  const xml = generateGoogleMerchantXml(items, baseUrl);

  const isDownload =
    url.searchParams.get("download") === "1" ||
    url.searchParams.get("download") === "true";

  const isTokenProtected = Boolean((process.env.FEED_ACCESS_TOKEN || "").trim());
  const cacheControl = isTokenProtected
    ? "private, no-cache, no-store, must-revalidate"
    : "public, max-age=3600, s-maxage=3600, stale-while-revalidate=600";

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": cacheControl,
      "Content-Disposition": isDownload
        ? 'attachment; filename="google-merchant-feed.xml"'
        : "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
