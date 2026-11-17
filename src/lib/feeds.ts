import { enabledProductCondition } from "@/lib/productAvailability";
import { getDb } from "@/lib/db";
import { timingSafeEqual } from "node:crypto";
import { gzipSync } from "node:zlib";
import { formatPackagingLabel } from "@/lib/productModels";
import { resolveProductCommercePolicy, type ProductPolicyOverrides } from "@/lib/seo/productPolicy";
import { getBulkApprovedReviewSummaries } from "@/lib/reviews";
import { getDynamicSiteConfig } from "@/lib/seo/site";

import type {
  FeedItem,
  FeedCatalogItem,
  FeedOptions,
  OpenAiFeedOptions,
  OpenAiFeedRecord,
  GoogleLocalPickupMethod,
  GoogleLocalPickupSla,
  GoogleLocalInventoryConfig,
  GoogleLocalInventoryItem,
} from "./feedTypes";
export type {
  FeedItem,
  FeedCatalogItem,
  FeedOptions,
  OpenAiFeedOptions,
  OpenAiFeedRecord,
  GoogleLocalPickupMethod,
  GoogleLocalPickupSla,
  GoogleLocalInventoryConfig,
  GoogleLocalInventoryItem,
};

interface RawFeedRow {
  variant_id: number;
  variant_sku: string | null;
  variant_grams: number;
  variant_servings: number | null;
  variant_packaging_format: string | null;
  variant_price_paise: number;
  variant_compare_at_price_paise?: number | null;
  variant_stock: number;
  product_id: number;
  product_slug: string;
  product_name: string;
  product_category: string | null;
  product_description: string | null;
  primary_image_url: string | null;
  shipping_fee_paise_override?: number | null;
  handling_days_min_override?: number | null;
  handling_days_max_override?: number | null;
  transit_days_min_override?: number | null;
  transit_days_max_override?: number | null;
  return_window_days_override?: number | null;
  return_fees_override?: string | null;
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

export { formatPackagingLabel };

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

function resolveAbsoluteImageUrl(baseUrl: string, rawUrl: string | null | undefined, fallbackPath = "/images/product-darjeeling-tin.jpg"): string {
  if (rawUrl && rawUrl.trim()) {
    const img = rawUrl.trim();
    if (/^https?:\/\//i.test(img)) return img;
    return `${baseUrl}${img.startsWith("/") ? "" : "/"}${img}`;
  }
  return `${baseUrl}${fallbackPath}`;
}

function extractPolicyOverrides(row: Record<string, unknown>): ProductPolicyOverrides {
  return {
    shipping_fee_paise_override:
      row.shipping_fee_paise_override != null ? Number(row.shipping_fee_paise_override) : null,
    handling_days_min_override:
      row.handling_days_min_override != null ? Number(row.handling_days_min_override) : null,
    handling_days_max_override:
      row.handling_days_max_override != null ? Number(row.handling_days_max_override) : null,
    transit_days_min_override:
      row.transit_days_min_override != null ? Number(row.transit_days_min_override) : null,
    transit_days_max_override:
      row.transit_days_max_override != null ? Number(row.transit_days_max_override) : null,
    return_window_days_override:
      row.return_window_days_override != null ? Number(row.return_window_days_override) : null,
    return_fees_override:
      typeof row.return_fees_override === "string" && row.return_fees_override ? row.return_fees_override : null,
  };
}

function getTableColumns(db: ReturnType<typeof getDb>, tableName: string): Set<string> {
  try {
    const exists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(tableName);
    if (!exists) return new Set();
    const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    return new Set(cols.map((c) => c.name));
  } catch {
    return new Set();
  }
}

/**
 * Queries active catalog products (Teas + published Trial Kits + published Private Label Packaging)
 * and maps each SKU/offer into a structured FeedItem with synchronized shipping, delivery,
 * return policy, and verified review metadata.
 */
export function getFeedCatalogData(originUrl?: string): FeedItem[] {
  const db = getDb();
  const baseUrl = resolveBaseUrl(originUrl);
  const siteConfig = getDynamicSiteConfig();

  let brandName = siteConfig.brand || siteConfig.name || "TeaFloww";
  let currencyCode = siteConfig.currency || "INR";
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

  const productCols = getTableColumns(db, "products");
  const variantCols = getTableColumns(db, "variants");
  const hasCategories = getTableColumns(db, "categories").size > 0;

  const productReviewMap = getBulkApprovedReviewSummaries("product");
  const trialReviewMap = getBulkApprovedReviewSummaries("trial");
  const packagingReviewMap = getBulkApprovedReviewSummaries("packaging");

  const extraProductSelect = [
    variantCols.has("compare_at_price_paise") ? "v.compare_at_price_paise AS variant_compare_at_price_paise" : "NULL AS variant_compare_at_price_paise",
    productCols.has("shipping_fee_paise_override") ? "p.shipping_fee_paise_override" : "NULL AS shipping_fee_paise_override",
    productCols.has("handling_days_min_override") ? "p.handling_days_min_override" : "NULL AS handling_days_min_override",
    productCols.has("handling_days_max_override") ? "p.handling_days_max_override" : "NULL AS handling_days_max_override",
    productCols.has("transit_days_min_override") ? "p.transit_days_min_override" : "NULL AS transit_days_min_override",
    productCols.has("transit_days_max_override") ? "p.transit_days_max_override" : "NULL AS transit_days_max_override",
    productCols.has("return_window_days_override") ? "p.return_window_days_override" : "NULL AS return_window_days_override",
    productCols.has("return_fees_override") ? "p.return_fees_override" : "NULL AS return_fees_override",
  ].join(",\n        ");

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
        ${extraProductSelect},
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
        ${extraProductSelect},
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
  const items: FeedItem[] = [];

  for (const row of rows) {
    const sku =
      row.variant_sku && row.variant_sku.trim()
        ? row.variant_sku.trim()
        : `HTH-${row.product_id}-${row.variant_id}`;
    const formatLabel = formatPackagingLabel(row.variant_packaging_format);
    const title = `${row.product_name} — ${formatLabel} (${row.variant_grams}g)`;
    const description = cleanDescription(row.product_description, row.product_name);
    const link = `${baseUrl}/tea/${row.product_slug}?sku=${encodeURIComponent(sku)}`;
    const imageLink = resolveAbsoluteImageUrl(baseUrl, row.primary_image_url);

    const reviewSummary = productReviewMap.get(String(row.product_id)) || null;
    const policy = resolveProductCommercePolicy({
      entityType: "product",
      entityId: row.product_id,
      overrides: extractPolicyOverrides(row as unknown as Record<string, unknown>),
      reviewSummary,
      siteUrlOverride: baseUrl,
    });

    const hasSale =
      row.variant_compare_at_price_paise != null &&
      row.variant_compare_at_price_paise > row.variant_price_paise;
    const regularPaise = hasSale ? row.variant_compare_at_price_paise! : row.variant_price_paise;
    const salePaise = hasSale ? row.variant_price_paise : null;
    const shippingPaise = policy.computeShippingRatePaise(row.variant_price_paise);

    items.push({
      id: sku,
      itemGroupId: row.product_slug,
      entityType: "product",
      title,
      description,
      link,
      imageLink,
      availability: row.variant_stock > 0 ? "in_stock" : "out_of_stock",
      price: `${(regularPaise / 100).toFixed(2)} ${currencyCode}`,
      ...(salePaise !== null ? { salePrice: `${(salePaise / 100).toFixed(2)} ${currencyCode}` } : {}),
      brand: brandName,
      condition: "new",
      googleProductCategory: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
      productType: row.product_category ? `Tea > ${row.product_category}` : "Tea",
      packagingFormat: row.variant_packaging_format || "loose_leaf_pouch",
      sizeGrams: row.variant_grams,
      stock: row.variant_stock,
      shippingPrice: `${(shippingPaise / 100).toFixed(2)} ${currencyCode}`,
      shippingCountry: policy.applicableCountry,
      minHandlingTime: policy.handlingDaysMin,
      maxHandlingTime: policy.handlingDaysMax,
      minTransitTime: policy.transitDaysMin,
      maxTransitTime: policy.transitDaysMax,
      acceptsReturns: true,
      returnWindowDays: policy.returnWindowDays,
      returnFees: policy.returnFees,
      returnPolicyUrl: policy.returnPolicyUrl,
      ...(policy.returnPolicyLabel ? { returnPolicyLabel: policy.returnPolicyLabel } : {}),
      ...(reviewSummary
        ? {
            reviewCount: reviewSummary.reviewCount,
            starRating: reviewSummary.ratingValue,
          }
        : {}),
    });
  }

  // 2. Include Published Trial Kits
  const trialCols = getTableColumns(db, "trials");
  if (trialCols.size > 0) {
    try {
      const noindexFilter = trialCols.has("noindex") ? " AND COALESCE(t.noindex, 0) = 0" : "";
      const trialRows = db
        .prepare(
          `SELECT t.*,
                  COALESCE(
                    (SELECT m.url FROM media_uploads m WHERE m.id = t.hero_image_id LIMIT 1),
                    (SELECT ta.asset_url FROM trial_assets ta WHERE ta.trial_id = t.id ORDER BY ta.sort_order ASC LIMIT 1)
                  ) AS hero_url
           FROM trials t
           WHERE t.status = 'published' AND t.price_paise > 0${noindexFilter}
           ORDER BY t.published_at DESC, t.created_at DESC`
        )
        .all() as Array<Record<string, unknown>>;

      for (const t of trialRows) {
        const trialId = String(t.id);
        const slug = String(t.slug);
        const title = String(t.title || slug);
        const sku = String(t.sku || `TRIAL-${slug.toUpperCase()}`);
        const pricePaise = Number(t.price_paise || 0);
        const compareAt = t.compare_at_price_paise != null ? Number(t.compare_at_price_paise) : null;
        const inStock = String(t.inventory_policy || "track") === "continue" || Number(t.inventory_quantity || 0) > 0;
        const effectiveStock = String(t.inventory_policy || "track") === "continue"
          ? Math.max(1, Number(t.inventory_quantity || 10))
          : Math.max(0, Number(t.inventory_quantity || 0));

        const reviewSummary = trialReviewMap.get(trialId) || null;
        const policy = resolveProductCommercePolicy({
          entityType: "trial",
          entityId: trialId,
          overrides: extractPolicyOverrides(t),
          reviewSummary,
          siteUrlOverride: baseUrl,
        });

        const hasSale = compareAt !== null && compareAt > pricePaise;
        const regularPaise = hasSale ? compareAt! : pricePaise;
        const salePaise = hasSale ? pricePaise : null;
        const shippingPaise = policy.computeShippingRatePaise(pricePaise);

        items.push({
          id: sku,
          itemGroupId: `trial-${slug}`,
          entityType: "trial",
          title,
          description: cleanDescription((t.description as string) || (t.tagline as string), title),
          link: `${baseUrl}/trials/${slug}`,
          imageLink: resolveAbsoluteImageUrl(baseUrl, t.hero_url as string | null),
          availability: inStock ? "in_stock" : "out_of_stock",
          price: `${(regularPaise / 100).toFixed(2)} ${currencyCode}`,
          ...(salePaise !== null ? { salePrice: `${(salePaise / 100).toFixed(2)} ${currencyCode}` } : {}),
          brand: brandName,
          condition: "new",
          googleProductCategory: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
          productType: "Tea > Trial Kits",
          sizeGrams: Number(t.net_weight_g || 200),
          stock: effectiveStock,
          shippingPrice: `${(shippingPaise / 100).toFixed(2)} ${currencyCode}`,
          shippingCountry: policy.applicableCountry,
          minHandlingTime: policy.handlingDaysMin,
          maxHandlingTime: policy.handlingDaysMax,
          minTransitTime: policy.transitDaysMin,
          maxTransitTime: policy.transitDaysMax,
          acceptsReturns: true,
          returnWindowDays: policy.returnWindowDays,
          returnFees: policy.returnFees,
          returnPolicyUrl: policy.returnPolicyUrl,
          ...(policy.returnPolicyLabel ? { returnPolicyLabel: policy.returnPolicyLabel } : {}),
          ...(reviewSummary
            ? {
                reviewCount: reviewSummary.reviewCount,
                starRating: reviewSummary.ratingValue,
              }
            : {}),
        });
      }
    } catch {
      // Optional trials table or minimal test schema
    }
  }

  // 3. Include Published Private Label Packaging Variants (when priced in active price book)
  const packCols = getTableColumns(db, "pl_packaging_variants");
  if (packCols.size > 0 && getTableColumns(db, "pl_price_book_tiers").size > 0) {
    try {
      const packRows = db
        .prepare(
          `SELECT v.*,
                  (
                    SELECT t.unit_price_paise
                    FROM pl_price_book_tiers t
                    JOIN pl_price_books b ON b.id = t.price_book_id
                    WHERE b.status = 'active' AND t.item_type = 'packaging' AND t.item_id = v.id
                    ORDER BY b.is_default DESC, t.min_qty ASC
                    LIMIT 1
                  ) AS starting_unit_price_paise
           FROM pl_packaging_variants v
           WHERE v.status = 'published'
           ORDER BY v.created_at ASC`
        )
        .all() as Array<Record<string, unknown>>;

      for (const p of packRows) {
        const unitPaise = Number(p.starting_unit_price_paise || 0);
        if (!Number.isFinite(unitPaise) || unitPaise <= 0) continue;

        const packId = String(p.id);
        const slug = String(p.slug);
        const title = String(p.title || slug);
        const sku = String(p.sku || slug);
        const leadDays = Number(p.lead_time_days || 14);
        const reviewSummary = packagingReviewMap.get(packId) || null;
        const policy = resolveProductCommercePolicy({
          entityType: "packaging",
          entityId: packId,
          overrides: extractPolicyOverrides(p),
          extraHandlingDays: leadDays,
          reviewSummary,
          siteUrlOverride: baseUrl,
        });
        const shippingPaise = policy.computeShippingRatePaise(unitPaise * Number(p.moq_units || 1));

        items.push({
          id: sku,
          itemGroupId: `packaging-${slug}`,
          entityType: "packaging",
          title,
          description: `${title}. Food-grade ${String(p.material || "barrier")} packaging with ${String(p.finish || "matte")} finish. Capacity: ${String(p.capacity_description || `${Number(p.net_weight_capacity_grams || 100)}g`)}. MOQ: ${Number(p.moq_units || 500)} units.`,
          link: `${baseUrl}/private-label/packaging/${slug}`,
          imageLink: resolveAbsoluteImageUrl(baseUrl, p.hero_image_url as string | null, "/images/packaging-fallback.png"),
          availability: "in_stock",
          price: `${(unitPaise / 100).toFixed(2)} ${currencyCode}`,
          brand: brandName,
          condition: "new",
          googleProductCategory: "Business & Industrial > Packaging & Shipping",
          productType: "Tea > Private Label Packaging",
          sizeGrams: Number(p.net_weight_capacity_grams || 100),
          stock: Math.max(1, Number(p.moq_units || 250)),
          shippingPrice: `${(shippingPaise / 100).toFixed(2)} ${currencyCode}`,
          shippingCountry: policy.applicableCountry,
          minHandlingTime: policy.handlingDaysMin,
          maxHandlingTime: policy.handlingDaysMax,
          minTransitTime: policy.transitDaysMin,
          maxTransitTime: policy.transitDaysMax,
          acceptsReturns: true,
          returnWindowDays: policy.returnWindowDays,
          returnFees: policy.returnFees,
          returnPolicyUrl: policy.returnPolicyUrl,
          ...(policy.returnPolicyLabel ? { returnPolicyLabel: policy.returnPolicyLabel } : {}),
          ...(reviewSummary
            ? {
                reviewCount: reviewSummary.reviewCount,
                starRating: reviewSummary.ratingValue,
              }
            : {}),
        });
      }
    } catch {
      // Optional private label pricing tables
    }
  }

  return items;
}

/**
 * Generates valid RSS 2.0 XML with the Google Merchant Center namespace (xmlns:g="http://base.google.com/ns/1.0").
 */
export function generateGoogleMerchantXml(items: FeedItem[], originUrl?: string): string {
  const baseUrl = resolveBaseUrl(originUrl);
  const lastBuildDate = new Date().toUTCString();
  const siteConfig = getDynamicSiteConfig();
  const channelTitle = `${siteConfig.name || "TeaFloww"} Catalog`;

  const itemsXml = items
    .map((item) => {
      const extraLines: string[] = [];
      if (item.productType) {
        extraLines.push(`      <g:product_type>${escapeXml(item.productType)}</g:product_type>`);
      }
      if (item.salePrice) {
        extraLines.push(`      <g:sale_price>${escapeXml(item.salePrice)}</g:sale_price>`);
      }
      if (typeof item.sizeGrams === "number" && item.sizeGrams > 0) {
        extraLines.push(`      <g:shipping_weight>${escapeXml(`${item.sizeGrams} g`)}</g:shipping_weight>`);
      }
      if (item.shippingPrice) {
        const minH = item.minHandlingTime ?? 1;
        const maxH = item.maxHandlingTime ?? 2;
        const minT = item.minTransitTime ?? 2;
        const maxT = item.maxTransitTime ?? 5;
        extraLines.push(
          `      <g:shipping>\n` +
            `        <g:country>${escapeXml(item.shippingCountry || "IN")}</g:country>\n` +
            `        <g:service>Standard</g:service>\n` +
            `        <g:price>${escapeXml(item.shippingPrice)}</g:price>\n` +
            `        <g:min_handling_time>${minH}</g:min_handling_time>\n` +
            `        <g:max_handling_time>${maxH}</g:max_handling_time>\n` +
            `        <g:min_transit_time>${minT}</g:min_transit_time>\n` +
            `        <g:max_transit_time>${maxT}</g:max_transit_time>\n` +
            `      </g:shipping>`
        );
      }
      if (item.returnPolicyLabel) {
        extraLines.push(`      <g:return_policy_label>${escapeXml(item.returnPolicyLabel)}</g:return_policy_label>`);
      }

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
      <g:identifier_exists>no</g:identifier_exists>${extraLines.length ? `\n${extraLines.join("\n")}` : ""}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
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
    "sale_price",
    "product_type",
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
      escapeCsvField(item.salePrice || ""),
      escapeCsvField(item.productType || ""),
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
  const policy = resolveProductCommercePolicy({ siteUrlOverride: baseUrl });

  const effectiveShippingPrice = item.shippingPrice || `${(policy.flatShippingPaise / 100).toFixed(2)} ${policy.currency}`;
  const minH = item.minHandlingTime ?? policy.handlingDaysMin;
  const maxH = item.maxHandlingTime ?? policy.handlingDaysMax;
  const minT = item.minTransitTime ?? policy.transitDaysMin;
  const maxT = item.maxTransitTime ?? policy.transitDaysMax;
  const totalMin = minH + minT;
  const totalMax = maxH + maxT;
  const deliveryEstimate = totalMin === totalMax ? `${totalMin} business days` : `${totalMin}–${totalMax} business days`;

  const record: OpenAiFeedRecord = {
    item_id: item.id,
    title: item.title,
    description: item.description,
    url: item.link,
    image_url: item.imageLink,
    price: item.price,
    ...(item.salePrice ? { sale_price: item.salePrice } : {}),
    availability: item.availability,
    brand: item.brand,
    seller_name: sellerName,
    target_countries: targetCountries,
    store_country: storeCountry,
    is_eligible_search: options?.isEligibleSearch ?? true,
    is_eligible_checkout: options?.isEligibleCheckout ?? false,
    shipping: `${item.shippingCountry || storeCountry}::Standard:${effectiveShippingPrice}`,
    shipping_price: effectiveShippingPrice,
    delivery_estimate: deliveryEstimate,
    min_handling_time: minH,
    max_handling_time: maxH,
    min_transit_time: minT,
    max_transit_time: maxT,
    accepts_returns: item.acceptsReturns ?? true,
    return_window: item.returnWindowDays ?? policy.returnWindowDays,
    return_policy: item.returnPolicyUrl || policy.returnPolicyUrl,
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
  if (typeof item.reviewCount === "number" && item.reviewCount > 0 && typeof item.starRating === "number" && item.starRating > 0) {
    record.review_count = item.reviewCount;
    record.star_rating = item.starRating.toFixed(2);
  }

  return record;
}

/**
 * Generates Google Merchant Center Product Ratings XML feed strictly from real approved reviews.
 */
export function generateGoogleProductReviewsXml(originUrl?: string): string {
  const db = getDb();
  const baseUrl = resolveBaseUrl(originUrl);
  const siteConfig = getDynamicSiteConfig();
  const publisherName = siteConfig.name || "TeaFloww";

  let reviewRows: Array<{
    id: number;
    entity_type: string;
    entity_id: string;
    reviewer_name: string;
    rating: number;
    title: string;
    body: string;
    created_at: string;
  }> = [];

  try {
    const hasTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_reviews'")
      .get();
    if (hasTable) {
      reviewRows = db
        .prepare(
          `SELECT id, entity_type, entity_id, reviewer_name, rating, title, body, created_at
           FROM product_reviews
           WHERE status = 'approved'
           ORDER BY created_at DESC`
        )
        .all() as typeof reviewRows;
    }
  } catch {
    reviewRows = [];
  }

  const catalogItems = getFeedCatalogData(baseUrl);
  const skusByProductSlug = new Map<string, string[]>();
  for (const item of catalogItems) {
    const list = skusByProductSlug.get(item.itemGroupId) || [];
    list.push(item.id);
    skusByProductSlug.set(item.itemGroupId, list);
  }

  const reviewsXml = reviewRows
    .map((r) => {
      let itemUrl = baseUrl;
      let productName = publisherName;
      let skus: string[] = [];

      try {
        if (r.entity_type === "product") {
          const p = db
            .prepare("SELECT slug, name FROM products WHERE id = ?")
            .get(Number(r.entity_id)) as { slug: string; name: string } | undefined;
          if (p) {
            itemUrl = `${baseUrl}/tea/${p.slug}`;
            productName = p.name;
            skus = skusByProductSlug.get(p.slug) || [];
          }
        } else if (r.entity_type === "trial") {
          const t = db
            .prepare("SELECT slug, title, sku FROM trials WHERE id = ?")
            .get(r.entity_id) as { slug: string; title: string; sku: string } | undefined;
          if (t) {
            itemUrl = `${baseUrl}/trials/${t.slug}`;
            productName = t.title;
            skus = [t.sku];
          }
        } else if (r.entity_type === "packaging") {
          const pk = db
            .prepare("SELECT slug, title, sku FROM pl_packaging_variants WHERE id = ?")
            .get(r.entity_id) as { slug: string; title: string; sku: string } | undefined;
          if (pk) {
            itemUrl = `${baseUrl}/private-label/packaging/${pk.slug}`;
            productName = pk.title;
            skus = [pk.sku];
          }
        }
      } catch {
        // Skip metadata lookup errors
      }

      const timestamp = r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString();
      const skuNodes = skus.map((s) => `          <sku>${escapeXml(s)}</sku>`).join("\n");

      return `    <review>
      <review_id>${escapeXml(String(r.id))}</review_id>
      <reviewer>
        <name>${escapeXml(r.reviewer_name)}</name>
      </reviewer>
      <review_timestamp>${escapeXml(timestamp)}</review_timestamp>
      ${r.title ? `<title>${escapeXml(r.title)}</title>\n      ` : ""}<content>${escapeXml(r.body)}</content>
      <review_url type="singleton">${escapeXml(itemUrl)}</review_url>
      <ratings>
        <overall min="1" max="5">${escapeXml(r.rating)}</overall>
      </ratings>
      <products>
        <product>
          <product_ids>
            <skus>
${skuNodes}
            </skus>
          </product_ids>
          <product_name>${escapeXml(productName)}</product_name>
          <product_url>${escapeXml(itemUrl)}</product_url>
        </product>
      </products>
    </review>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:vc="http://www.w3.org/2007/XMLSchema-versioning" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.google.com/shopping/reviews/schema/product/2.3/product_reviews.xsd">
  <version>2.3</version>
  <aggregator>
    <name>${escapeXml(publisherName)}</name>
  </aggregator>
  <publisher>
    <name>${escapeXml(publisherName)}</name>
  </publisher>
  <reviews>
${reviewsXml ? `${reviewsXml}\n` : ""}  </reviews>
</feed>`;
}

export function buildGoogleReviewsFeedResponse(request: Request): Response {
  if (!isFeedAuthorized(request)) {
    return feedUnauthorizedResponse();
  }
  const url = new URL(request.url);
  const explicitBase = url.searchParams.get("base_url") || undefined;
  const originUrl = getRequestOrigin(request);
  const baseUrl = resolveBaseUrl(originUrl, { explicitOverride: explicitBase });
  const xml = generateGoogleProductReviewsXml(baseUrl);
  const isDownload =
    url.searchParams.get("download") === "1" ||
    url.searchParams.get("download") === "true";

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": getFeedCacheControl(),
      "Content-Disposition": isDownload
        ? 'attachment; filename="google-product-reviews.xml"'
        : "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
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

  const cacheControl = getFeedCacheControl();

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

function getFeedCacheControl(): string {
  const isTokenProtected = Boolean((process.env.FEED_ACCESS_TOKEN || "").trim());
  return isTokenProtected
    ? "private, no-cache, no-store, must-revalidate"
    : "public, max-age=3600, s-maxage=3600, stale-while-revalidate=600";
}

const VALID_PICKUP_METHODS = new Set<GoogleLocalPickupMethod>([
  "buy",
  "reserve",
  "ship to store",
  "not supported",
]);

const VALID_PICKUP_SLAS = new Set<GoogleLocalPickupSla>([
  "same_day",
  "next_day",
  "2-day",
  "3-day",
  "4-day",
  "5-day",
  "6-day",
  "multi-week",
]);

export interface ResolvedLocalInventoryConfig {
  storeCode: string;
  pickupMethod?: GoogleLocalPickupMethod;
  pickupSla?: GoogleLocalPickupSla;
  rawPickupMethod?: string;
  rawPickupSla?: string;
}

/**
 * Resolves Google Merchant Center Local Inventory settings from explicit query overrides,
 * store_settings DB rows, or environment variables.
 */
export function resolveLocalInventoryConfig(overrides?: {
  storeCode?: string | null;
  pickupMethod?: string | null;
  pickupSla?: string | null;
}): ResolvedLocalInventoryConfig {
  const dbSettings = new Map<string, string>();
  try {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT key, value FROM store_settings WHERE key IN ('google_local_store_code', 'google_local_pickup_method', 'google_local_pickup_sla')"
      )
      .all() as Array<{ key: string; value: string }>;
    for (const row of rows) {
      dbSettings.set(row.key, row.value);
    }
  } catch {
    // Graceful fallback when store_settings is unavailable
  }

  const storeCode = (
    overrides?.storeCode ||
    dbSettings.get("google_local_store_code") ||
    process.env.GOOGLE_LOCAL_STORE_CODE ||
    process.env.FEED_LOCAL_STORE_CODE ||
    ""
  ).trim();

  const rawPickupMethod = (
    overrides?.pickupMethod ??
    dbSettings.get("google_local_pickup_method") ??
    process.env.GOOGLE_LOCAL_PICKUP_METHOD ??
    ""
  )
    .trim()
    .toLowerCase();

  const rawPickupSla = (
    overrides?.pickupSla ??
    dbSettings.get("google_local_pickup_sla") ??
    process.env.GOOGLE_LOCAL_PICKUP_SLA ??
    ""
  )
    .trim()
    .toLowerCase();

  const pickupMethod = VALID_PICKUP_METHODS.has(rawPickupMethod as GoogleLocalPickupMethod)
    ? (rawPickupMethod as GoogleLocalPickupMethod)
    : undefined;
  const pickupSla = VALID_PICKUP_SLAS.has(rawPickupSla as GoogleLocalPickupSla)
    ? (rawPickupSla as GoogleLocalPickupSla)
    : undefined;

  return {
    storeCode,
    pickupMethod,
    pickupSla,
    rawPickupMethod: rawPickupMethod || undefined,
    rawPickupSla: rawPickupSla || undefined,
  };
}

/**
 * Maps catalog FeedItems into Google Local Product Inventory records.
 * Product IDs match <g:id> in the primary online feed; out-of-stock items are never marked pickup-eligible.
 */
export function mapFeedItemsToLocalInventory(
  items: FeedItem[],
  config: GoogleLocalInventoryConfig
): GoogleLocalInventoryItem[] {
  const storeCode = config.storeCode.trim();
  const hasActivePickup =
    Boolean(config.pickupMethod) && config.pickupMethod !== "not supported";

  return items.map((item) => {
    const quantity = Math.max(0, Math.floor(Number.isFinite(item.stock) ? item.stock : 0));
    const availability = item.availability === "in_stock" && quantity > 0 ? "in_stock" : "out_of_stock";

    const record: GoogleLocalInventoryItem = {
      storeCode,
      id: item.id,
      availability,
      price: item.price,
      quantity,
    };

    if (hasActivePickup) {
      if (availability === "in_stock") {
        record.pickupMethod = config.pickupMethod;
        if (config.pickupSla) {
          record.pickupSla = config.pickupSla;
        }
      } else {
        // GMC rejects pickup_sla or pickup eligibility on out_of_stock items
        record.pickupMethod = "not supported";
      }
    } else if (config.pickupMethod === "not supported") {
      record.pickupMethod = "not supported";
    }

    return record;
  });
}

/**
 * Generates RSS 2.0 XML for Google Merchant Center Local Product Inventory feeds.
 */
export function generateGoogleLocalInventoryXml(
  localItems: GoogleLocalInventoryItem[],
  originUrl?: string
): string {
  const baseUrl = resolveBaseUrl(originUrl);
  const lastBuildDate = new Date().toUTCString();

  const itemsXml = localItems
    .map((item) => {
      const pickupLines = [
        item.pickupMethod ? `      <g:pickup_method>${escapeXml(item.pickupMethod)}</g:pickup_method>` : "",
        item.pickupSla ? `      <g:pickup_sla>${escapeXml(item.pickupSla)}</g:pickup_sla>` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return `    <item>
      <g:store_code>${escapeXml(item.storeCode)}</g:store_code>
      <g:id>${escapeXml(item.id)}</g:id>
      <g:availability>${escapeXml(item.availability)}</g:availability>
      <g:price>${escapeXml(item.price)}</g:price>
      <g:quantity>${escapeXml(item.quantity)}</g:quantity>${pickupLines ? `\n${pickupLines}` : ""}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Himalayan Tea House Local Inventory</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Local store inventory feed matching online product IDs for Google Merchant Center.</description>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${itemsXml ? `${itemsXml}\n` : ""}  </channel>
</rss>`;
}

function escapeDelimitedField(value: string | number | undefined, delimiter: "\t" | ","): string {
  if (delimiter === ",") {
    return escapeCsvField(value ?? "");
  }
  if (value === undefined || value === null) return "";
  return String(value).replace(/[\t\r\n]+/g, " ");
}

function formatGoogleLocalInventoryDelimited(
  localItems: GoogleLocalInventoryItem[],
  delimiter: "\t" | ","
): string {
  const includePickup = localItems.some((item) => Boolean(item.pickupMethod || item.pickupSla));
  const headers = [
    "store_code",
    "id",
    "availability",
    "price",
    "quantity",
    ...(includePickup ? ["pickup_method", "pickup_sla"] : []),
  ];

  const rows = localItems.map((item) => {
    const baseCols = [
      escapeDelimitedField(item.storeCode, delimiter),
      escapeDelimitedField(item.id, delimiter),
      escapeDelimitedField(item.availability, delimiter),
      escapeDelimitedField(item.price, delimiter),
      escapeDelimitedField(item.quantity, delimiter),
    ];
    if (includePickup) {
      baseCols.push(
        escapeDelimitedField(item.pickupMethod || "", delimiter),
        escapeDelimitedField(item.pickupSla || "", delimiter)
      );
    }
    return baseCols.join(delimiter);
  });

  const lineEnding = delimiter === "," ? "\r\n" : "\n";
  return [headers.join(delimiter), ...rows].join(lineEnding);
}

/**
 * Generates tab-delimited (TSV) Local Product Inventory feed for Google Merchant Center.
 */
export function generateGoogleLocalInventoryTsv(localItems: GoogleLocalInventoryItem[]): string {
  return formatGoogleLocalInventoryDelimited(localItems, "\t");
}

/**
 * Generates RFC 4180 CSV Local Product Inventory feed for Google Merchant Center.
 */
export function generateGoogleLocalInventoryCsv(localItems: GoogleLocalInventoryItem[]): string {
  return formatGoogleLocalInventoryDelimited(localItems, ",");
}

/**
 * Shared HTTP response builder for /feeds/google-local.xml, /feeds/google-local.tsv,
 * and /api/feeds/google-local-inventory.
 */
export function buildGoogleLocalInventoryFeedResponse(
  request: Request,
  defaultFormat: "xml" | "tsv" | "csv" = "xml"
): Response {
  if (!isFeedAuthorized(request)) {
    return feedUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const explicitBase = url.searchParams.get("base_url") || undefined;
  const originUrl = getRequestOrigin(request);
  const baseUrl = resolveBaseUrl(originUrl, { explicitOverride: explicitBase });

  const queryStoreCode = url.searchParams.get("store_code");
  const queryPickupMethod = url.searchParams.get("pickup_method");
  const queryPickupSla = url.searchParams.get("pickup_sla");

  const resolved = resolveLocalInventoryConfig({
    storeCode: queryStoreCode,
    pickupMethod: queryPickupMethod,
    pickupSla: queryPickupSla,
  });

  if (!resolved.storeCode) {
    return new Response(
      JSON.stringify({
        error:
          "Local inventory store_code is not configured. Set Google Business Profile Store Code in Admin > Settings or pass ?store_code=YOUR_GBP_STORE_CODE.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }

  if (!/^[a-zA-Z0-9_-]{1,50}$/.test(resolved.storeCode)) {
    return new Response(
      JSON.stringify({
        error:
          "Invalid store_code. Use up to 50 alphanumeric, hyphen, or underscore characters matching your Google Business Profile store code.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }

  if (resolved.rawPickupMethod && !resolved.pickupMethod) {
    return new Response(
      JSON.stringify({
        error:
          "Invalid pickup_method. Supported values: buy, reserve, ship to store, not supported.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }

  if (resolved.rawPickupSla && !resolved.pickupSla) {
    return new Response(
      JSON.stringify({
        error:
          "Invalid pickup_sla. Supported values: same_day, next_day, 2-day, 3-day, 4-day, 5-day, 6-day, multi-week.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }

  if (
    resolved.pickupMethod &&
    resolved.pickupMethod !== "not supported" &&
    !resolved.pickupSla
  ) {
    return new Response(
      JSON.stringify({
        error:
          "pickup_sla is required when pickup_method is buy, reserve, or ship to store (e.g. same_day or next_day).",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }

  const rawFormat = (url.searchParams.get("format") || defaultFormat).toLowerCase();
  const format: "xml" | "tsv" | "csv" =
    rawFormat === "tsv" ? "tsv" : rawFormat === "csv" ? "csv" : "xml";

  const items = getFeedCatalogData(baseUrl);
  const localItems = mapFeedItemsToLocalInventory(items, {
    storeCode: resolved.storeCode,
    pickupMethod: resolved.pickupMethod,
    pickupSla: resolved.pickupSla,
  });

  const isDownload =
    url.searchParams.get("download") === "1" ||
    url.searchParams.get("download") === "true";
  const cacheControl = getFeedCacheControl();

  if (format === "tsv") {
    return new Response(generateGoogleLocalInventoryTsv(localItems), {
      status: 200,
      headers: {
        "Content-Type": "text/tab-separated-values; charset=utf-8",
        "Cache-Control": cacheControl,
        "Content-Disposition": isDownload
          ? 'attachment; filename="google-local-inventory.tsv"'
          : "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (format === "csv") {
    return new Response(generateGoogleLocalInventoryCsv(localItems), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": cacheControl,
        "Content-Disposition": isDownload
          ? 'attachment; filename="google-local-inventory.csv"'
          : "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new Response(generateGoogleLocalInventoryXml(localItems, baseUrl), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": cacheControl,
      "Content-Disposition": isDownload
        ? 'attachment; filename="google-local-inventory.xml"'
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
