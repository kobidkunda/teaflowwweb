import { enabledProductCondition } from "@/lib/productAvailability";
import { getDb } from "@/lib/db";
import { timingSafeEqual } from "node:crypto";
import { gzipSync } from "node:zlib";

import type {
  FeedItem,
  FeedCatalogItem,
  FeedOptions,
  OpenAiFeedOptions,
  OpenAiFeedRecord,
} from "./feedTypes";
export type {
  FeedItem,
  FeedCatalogItem,
  FeedOptions,
  OpenAiFeedOptions,
  OpenAiFeedRecord,
};

interface RawFeedRow {
  variant_id: number;
  variant_sku: string | null;
  variant_grams: number;
  variant_servings: number | null;
  variant_packaging_format: string | null;
  variant_price_paise: number;
  variant_stock: number;
  product_id: number;
  product_slug: string;
  product_name: string;
  product_category: string | null;
  product_description: string | null;
  primary_image_url: string | null;
}

/**
 * Strips non-printable ASCII control characters outside of tab, newline, and CR,
 * then safely replaces predefined XML 1.0 entities.
 */
export function escapeXml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Escapes a CSV field adhering to RFC 4180 rules.
 * Values with quotes, commas, or newlines are quoted and inner quotes are doubled ("").
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Detects whether a given URL or hostname represents an internal, loopback, or private RFC 1918 address
 * (e.g. localhost, 127.0.0.1, 192.168.x.x, 10.x.x.x) that cannot be publicly crawled by external bots.
 */
export function isPrivateHost(urlOrHost: string): boolean {
  if (!urlOrHost) return false;
  const host = urlOrHost.replace(/^https?:\/\//i, "").split(/[:/]/)[0].toLowerCase().trim();
  if (!host) return false;
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".test")
  ) {
    return true;
  }
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true;
  return false;
}

export interface ResolveBaseUrlOptions {
  explicitOverride?: string | null;
  allowPrivate?: boolean;
}

/**
 * Resolves the absolute storefront base URL honoring overrides, environment variables, or request origins.
 * Ensures wildcard socket binding addresses (e.g. 0.0.0.0) and private internal LAN IPs are never emitted
 * into Google Merchant Center or Meta catalog feeds unless explicitly overridden.
 */
export function resolveBaseUrl(
  originUrl?: string,
  options?: ResolveBaseUrlOptions
): string {
  if (options?.explicitOverride && options.explicitOverride.trim()) {
    const trimmed = options.explicitOverride.trim().replace(/\/+$/, "");
    if (!trimmed.includes("0.0.0.0")) {
      return trimmed;
    }
  }

  const envUrl =
    process.env.FEED_BASE_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL;
  if (envUrl && envUrl.trim()) {
    const trimmed = envUrl.trim().replace(/\/+$/, "");
    if (!trimmed.includes("0.0.0.0")) {
      if (options?.allowPrivate || !isPrivateHost(trimmed)) {
        return trimmed;
      }
    }
  }

  try {
    const db = getDb();
    const row = db
      .prepare(
        "SELECT value FROM store_settings WHERE key IN ('feed_base_url', 'public_site_url', 'site_url') ORDER BY updated_at DESC LIMIT 1"
      )
      .get() as { value: string } | undefined;
    if (row?.value?.trim()) {
      const trimmed = row.value.trim().replace(/\/+$/, "");
      if (!trimmed.includes("0.0.0.0")) {
        if (options?.allowPrivate || !isPrivateHost(trimmed)) {
          return trimmed;
        }
      }
    }
  } catch {
    // Graceful fallback if database or store_settings table is not yet accessible
  }

  if (originUrl && originUrl.trim()) {
    const trimmed = originUrl.trim().replace(/\/+$/, "");
    if (!trimmed.includes("://0.0.0.0") && !trimmed.startsWith("0.0.0.0")) {
      if (options?.allowPrivate || !isPrivateHost(trimmed)) {
        return trimmed;
      }
    }
  }

  if (typeof process !== "undefined" && process.cwd && process.cwd().includes("teafloww")) {
    return "https://teafloww.com";
  }

  return "https://himalayantea.com";
}

export const getFeedBaseUrl = resolveBaseUrl;

/**
 * Extracts the incoming request origin honoring reverse proxies (x-forwarded-host, host)
 * and filtering out 0.0.0.0 server binding addresses.
 */
export function getRequestOrigin(request: Request): string | undefined {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (request.url.startsWith("https:") ? "https" : "http");

  if (host && !host.startsWith("0.0.0.0")) {
    return `${proto}://${host}`;
  }

  try {
    const url = new URL(request.url);
    if (url.origin && !url.origin.includes("0.0.0.0")) {
      return url.origin;
    }
  } catch {
    // Ignore invalid url
  }

  return undefined;
}

/**
 * Maps database packaging format enum to a user-facing label.
 */
export function formatPackagingLabel(format: string | null | undefined): string {
  switch (format) {
    case "luxury_tin":
      return "Luxury Tin";
    case "pyramid_bags":
      return "Pyramid Bags";
    case "loose_leaf_pouch":
    default:
      return "Loose Leaf Pouch";
  }
}

/**
 * Cleans product description by stripping HTML tags and normalizing whitespace.
 */
function cleanDescription(desc: string | null | undefined, productName: string): string {
  if (!desc || !desc.trim()) {
    return `${productName} — Single-estate artisan Himalayan orthodox tea.`;
  }
  const stripped = desc.replace(/<[^>]+>/g, " ");
  const cleaned = stripped.replace(/\s+/g, " ").trim();
  return cleaned || `${productName} — Single-estate artisan Himalayan orthodox tea.`;
}

/**
 * Queries active catalog products and their packaging variants from SQLite.
 * Maps each packaging variant into a structured FeedItem.
 */
export function getFeedCatalogData(originUrl?: string): FeedItem[] {
  const db = getDb();
  const baseUrl = resolveBaseUrl(originUrl);

  let brandName = "Himalayan Tea House";
  let currencyCode = "INR";
  try {
    const storeNameRow = db
      .prepare("SELECT value FROM store_settings WHERE key = 'store_name'")
      .get() as { value: string } | undefined;
    if (storeNameRow?.value?.trim()) {
      brandName = storeNameRow.value.trim();
    }
    const currencyRow = db
      .prepare("SELECT value FROM store_settings WHERE key = 'currency'")
      .get() as { value: string } | undefined;
    if (currencyRow?.value?.trim()) {
      currencyCode = currencyRow.value.trim();
    }
  } catch {
    // Graceful fallback if store_settings does not exist
  }

  let hasCategories = false;
  try {
    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'")
      .get();
    hasCategories = Boolean(tableCheck);
  } catch {
    hasCategories = false;
  }

  const query = hasCategories
    ? `
      SELECT
        v.id AS variant_id,
        v.sku AS variant_sku,
        v.grams AS variant_grams,
        v.servings AS variant_servings,
        v.packaging_format AS variant_packaging_format,
        v.price_paise AS variant_price_paise,
        v.stock AS variant_stock,
        p.id AS product_id,
        p.slug AS product_slug,
        p.name AS product_name,
        p.category AS product_category,
        p.description AS product_description,
        (
          SELECT pi.url
          FROM product_images pi
          WHERE pi.product_id = p.id
          ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
          LIMIT 1
        ) AS primary_image_url
      FROM variants v
      JOIN products p ON v.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE (p.category_id IS NULL OR c.is_active = 1) AND ${enabledProductCondition("p")}
      ORDER BY p.id ASC, v.grams ASC, v.id ASC
    `
    : `
      SELECT
        v.id AS variant_id,
        v.sku AS variant_sku,
        v.grams AS variant_grams,
        v.servings AS variant_servings,
        v.packaging_format AS variant_packaging_format,
        v.price_paise AS variant_price_paise,
        v.stock AS variant_stock,
        p.id AS product_id,
        p.slug AS product_slug,
        p.name AS product_name,
        p.category AS product_category,
        p.description AS product_description,
        (
          SELECT pi.url
          FROM product_images pi
          WHERE pi.product_id = p.id
          ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
          LIMIT 1
        ) AS primary_image_url
      FROM variants v
      JOIN products p ON v.product_id = p.id
      WHERE ${enabledProductCondition("p")}
      ORDER BY p.id ASC, v.grams ASC, v.id ASC
    `;

  const rows = db.prepare(query).all() as RawFeedRow[];

  return rows.map((row) => {
    const sku =
      row.variant_sku && row.variant_sku.trim()
        ? row.variant_sku.trim()
        : `HTH-${row.product_id}-${row.variant_id}`;
    const formatLabel = formatPackagingLabel(row.variant_packaging_format);
    const title = `${row.product_name} — ${formatLabel} (${row.variant_grams}g)`;
    const description = cleanDescription(row.product_description, row.product_name);
    const link = `${baseUrl}/tea/${row.product_slug}?sku=${encodeURIComponent(sku)}`;

    let imageLink = `${baseUrl}/images/product-darjeeling-tin.jpg`;
    if (row.primary_image_url && row.primary_image_url.trim()) {
      const img = row.primary_image_url.trim();
      if (/^https?:\/\//i.test(img)) {
        imageLink = img;
      } else {
        imageLink = `${baseUrl}${img.startsWith("/") ? "" : "/"}${img}`;
      }
    }

    const availability = row.variant_stock > 0 ? "in_stock" : "out_of_stock";
    const price = `${(row.variant_price_paise / 100).toFixed(2)} ${currencyCode}`;

    return {
      id: sku,
      itemGroupId: row.product_slug,
      title,
      description,
      link,
      imageLink,
      availability,
      price,
      brand: brandName,
      condition: "new",
      googleProductCategory: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
      productType: row.product_category ? `Tea > ${row.product_category}` : "Tea",
      packagingFormat: row.variant_packaging_format || "loose_leaf_pouch",
      sizeGrams: row.variant_grams,
      stock: row.variant_stock,
    };
  });
}

/**
 * Generates valid RSS 2.0 XML with the Google Merchant Center namespace (xmlns:g="http://base.google.com/ns/1.0").
 */
export function generateGoogleMerchantXml(items: FeedItem[], originUrl?: string): string {
  const baseUrl = resolveBaseUrl(originUrl);
  const lastBuildDate = new Date().toUTCString();

  const itemsXml = items
    .map((item) => {
      return `    <item>
      <g:id>${escapeXml(item.id)}</g:id>
      <g:title>${escapeXml(item.title)}</g:title>
      <g:description>${escapeXml(item.description)}</g:description>
      <g:link>${escapeXml(item.link)}</g:link>
      <g:image_link>${escapeXml(item.imageLink)}</g:image_link>
      <g:availability>${escapeXml(item.availability)}</g:availability>
      <g:price>${escapeXml(item.price)}</g:price>
      <g:brand>${escapeXml(item.brand)}</g:brand>
      <g:condition>${escapeXml(item.condition)}</g:condition>
      <g:google_product_category>${escapeXml(item.googleProductCategory)}</g:google_product_category>
      <g:item_group_id>${escapeXml(item.itemGroupId)}</g:item_group_id>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Himalayan Tea House Catalog</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Direct single-estate orthodox artisan loose-leaf teas from high-elevation Himalayan gardens.</description>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${itemsXml ? `${itemsXml}\n` : ""}  </channel>
</rss>`;
}

/**
 * Generates RFC 4180 compliant CSV export for Meta (Facebook/Instagram) Catalog & Google Merchant Center.
 */
export function generateMetaCatalogCsv(items: FeedItem[]): string {
  const headers = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "brand",
    "google_product_category",
    "item_group_id",
  ];

  const rows = items.map((item) => {
    return [
      escapeCsvField(item.id),
      escapeCsvField(item.title),
      escapeCsvField(item.description),
      escapeCsvField(item.availability),
      escapeCsvField(item.condition),
      escapeCsvField(item.price),
      escapeCsvField(item.link),
      escapeCsvField(item.imageLink),
      escapeCsvField(item.brand),
      escapeCsvField(item.googleProductCategory),
      escapeCsvField(item.itemGroupId),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n");
}

function resolveTargetCountries(explicit?: string[]): string[] {
  if (explicit && explicit.length > 0) {
    const cleaned = explicit.map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (cleaned.length > 0) return cleaned;
  }
  const envCountries = (process.env.FEED_TARGET_COUNTRIES || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  return envCountries.length > 0 ? envCountries : ["IN"];
}

function resolveStoreCountry(explicit?: string): string {
  const candidate = (explicit || process.env.FEED_STORE_COUNTRY || "IN").trim().toUpperCase();
  return candidate || "IN";
}

/**
 * Maps a catalog FeedItem into an OpenAI Commerce Product Feed record
 * conforming to https://developers.openai.com/commerce/specs/file-upload/products.
 */
export function mapFeedItemToOpenAiRecord(
  item: FeedItem,
  originUrl?: string,
  options?: OpenAiFeedOptions
): OpenAiFeedRecord {
  const baseUrl = resolveBaseUrl(originUrl);
  const sellerName = (options?.sellerName || item.brand || "TeaFloww").trim();
  const sellerUrl = (options?.sellerUrl || baseUrl).trim();
  const targetCountries = resolveTargetCountries(options?.targetCountries);
  const storeCountry = resolveStoreCountry(options?.storeCountry);

  const record: OpenAiFeedRecord = {
    item_id: item.id,
    title: item.title,
    description: item.description,
    url: item.link,
    image_url: item.imageLink,
    price: item.price,
    availability: item.availability,
    brand: item.brand,
    seller_name: sellerName,
    target_countries: targetCountries,
    store_country: storeCountry,
    is_eligible_search: options?.isEligibleSearch ?? true,
    is_eligible_checkout: options?.isEligibleCheckout ?? false,
  };

  if (item.itemGroupId) {
    record.item_group_id = item.itemGroupId;
  }
  if (item.condition) {
    record.condition = item.condition;
  }
  if (item.googleProductCategory) {
    record.product_category = item.googleProductCategory;
  }
  if (sellerUrl) {
    record.seller_url = sellerUrl;
  }
  if (typeof item.sizeGrams === "number" && item.sizeGrams > 0) {
    record.weight = `${item.sizeGrams} g`;
  }
  if (typeof item.stock === "number" && item.stock >= 0) {
    record.inventory_quantity = item.stock;
  }

  return record;
}

/**
 * Generates UTF-8 JSONL (newline-delimited JSON) for the OpenAI Commerce Product Feed specification.
 */
export function generateOpenAiProductFeedJsonl(
  items: FeedItem[],
  originUrl?: string,
  options?: OpenAiFeedOptions
): string {
  const baseUrl = resolveBaseUrl(originUrl);
  return items
    .map((item) => JSON.stringify(mapFeedItemToOpenAiRecord(item, baseUrl, options)))
    .join("\n");
}

/**
 * Shared HTTP response builder for /feeds/openai.jsonl and /api/feeds/openai.
 * Supports ?download=1, ?gzip=1 (for .jsonl.gz snapshots), ?base_url=..., and FEED_ACCESS_TOKEN.
 */
export function buildOpenAiFeedResponse(request: Request): Response {
  if (!isFeedAuthorized(request)) {
    return feedUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const explicitBase = url.searchParams.get("base_url") || undefined;
  const originUrl = getRequestOrigin(request);
  const baseUrl = resolveBaseUrl(originUrl, { explicitOverride: explicitBase });
  const items = getFeedCatalogData(baseUrl);
  const jsonl = generateOpenAiProductFeedJsonl(items, baseUrl);

  const isDownload =
    url.searchParams.get("download") === "1" ||
    url.searchParams.get("download") === "true";
  const isGzip =
    url.searchParams.get("gzip") === "1" ||
    url.searchParams.get("gzip") === "true" ||
    url.searchParams.get("format") === "jsonl.gz";

  const isTokenProtected = Boolean((process.env.FEED_ACCESS_TOKEN || "").trim());
  const cacheControl = isTokenProtected
    ? "private, no-cache, no-store, must-revalidate"
    : "public, max-age=3600, s-maxage=3600, stale-while-revalidate=600";

  if (isGzip) {
    const compressed = gzipSync(Buffer.from(jsonl, "utf8"));
    return new Response(compressed, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Cache-Control": cacheControl,
        "Content-Disposition": 'attachment; filename="openai-product-feed.jsonl.gz"',
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new Response(jsonl, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": cacheControl,
      "Content-Disposition": isDownload
        ? 'attachment; filename="openai-product-feed.jsonl"'
        : "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Validates request authorization against the optional FEED_ACCESS_TOKEN environment variable.
 * If unset or empty, allows public access.
 * If set, expects matching query parameter (?token=... or ?feed_token=...) or Authorization: Bearer <token>.
 * Compares securely using crypto.timingSafeEqual.
 */
export function isFeedAuthorized(request: Request): boolean {
  const configuredToken = (process.env.FEED_ACCESS_TOKEN || "").trim();
  if (!configuredToken) {
    return true;
  }

  let providedToken: string | null = null;
  try {
    const url = new URL(request.url);
    providedToken =
      url.searchParams.get("token") ||
      url.searchParams.get("feed_token") ||
      url.searchParams.get("access_token");
  } catch {
    providedToken = null;
  }

  if (!providedToken) {
    const authHeader =
      request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      providedToken = authHeader.slice(7).trim();
    }
  }

  if (!providedToken) {
    return false;
  }

  const bufConfigured = Buffer.from(configuredToken);
  const bufProvided = Buffer.from(providedToken);

  if (bufConfigured.length !== bufProvided.length) {
    return false;
  }

  return timingSafeEqual(bufConfigured, bufProvided);
}

/**
 * Returns a standardized HTTP 401 Unauthorized response for unauthorized feed requests.
 */
export function feedUnauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized: Valid feed access token required" }),
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Bearer realm="Himalayan Tea House Product Feeds"',
        "Content-Type": "application/json",
      },
    }
  );
}
