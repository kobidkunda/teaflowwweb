import { listProductImages } from "@/lib/productImages";
import { getDb } from "@/lib/db";
import type { TrackingItem } from "@/lib/seo/tracking";

export type Slider = {
  id: number;
  title: string;
  subtitle: string;
  image_url: string;
  fg_image_url?: string;
  cta_label: string;
  cta_href: string;
  sort_order: number;
  card_tag?: string;
  card_title?: string;
  card_subtitle?: string;
  card_tasting_notes?: string;
  card_quote?: string;
  card_badge?: string;
  card_cta_label?: string;
  card_cta_href?: string;
  card_enabled?: number;
  chapter_label?: string;
  page_target?: "home" | "shop" | "all";
  category_slug?: string;
};

export type Category = {
  id: number;
  slug: string;
  name: string;
  cover_image_url?: string | null;
  description?: string | null;
};

export type ProductImage = {
  id: number;
  product_id: number;
  url: string;
  alt_text: string;
  sort_order: number;
  is_primary: number;
  variant_skus?: string[];
};

const tableExistsCache = new Map<string, boolean>();

function tableExists(table: string): boolean {
  if (tableExistsCache.has(table)) {
    return tableExistsCache.get(table)!;
  }
  try {
    const row = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(table) as { name: string } | undefined;
    const exists = !!row;
    if (exists) tableExistsCache.set(table, true);
    return exists;
  } catch {
    return false;
  }
}

function columnsOf(table: string): Set<string> {
  try {
    const rows = getDb().prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
    }[];
    return new Set(rows.map((r) => r.name));
  } catch {
    return new Set();
  }
}

/** Active homepage sliders within [starts_at, ends_at]; [] when table absent. */
export function listActiveSliders(): Slider[] {
  if (!tableExists("sliders")) return [];
  try {
    const cols = columnsOf("sliders");
    const hasWindow = cols.has("starts_at") && cols.has("ends_at");
    const sql = hasWindow
      ? `SELECT *
         FROM sliders WHERE is_active=1
         AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
         AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)
         ORDER BY sort_order ASC, id ASC`
      : `SELECT *
         FROM sliders WHERE is_active=1 ORDER BY sort_order ASC, id ASC`;
    return getDb().prepare(sql).all() as Slider[];
  } catch {
    return [];
  }
}

/** Categories from the normalized table; falls back to distinct product.category. */
export function listStorefrontCategories(): Category[] {
  try {
    if (tableExists("categories")) {
      const rows = getDb()
        .prepare(
          "SELECT id, slug, name, cover_image_url, description FROM categories WHERE is_active=1 ORDER BY sort_order ASC, name ASC"
        )
        .all() as Category[];
      if (rows.length) return rows;
    }
  } catch {
    /* fall through to legacy */
  }
  try {
    const rows = getDb()
      .prepare(
        "SELECT DISTINCT category AS name FROM products WHERE status = 'published' AND is_enabled = 1 AND category IS NOT NULL AND category != '' ORDER BY category ASC"
      )
      .all() as { name: string }[];
    return rows.map((r, i) => ({ id: -(i + 1), slug: r.name, name: r.name }));
  } catch {
    const rows = getDb()
      .prepare(
        "SELECT DISTINCT category AS name FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category ASC"
      )
      .all() as { name: string }[];
    return rows.map((r, i) => ({ id: -(i + 1), slug: r.name, name: r.name }));
  }
}

/** Gallery images for a product; [] when table absent (caller shows placeholder). */
export function getProductImages(productId: number): ProductImage[] {
  if (!tableExists("product_images")) return [];
  try {
    return listProductImages(productId).sort((a, b) => b.is_primary - a.is_primary || a.sort_order - b.sort_order || a.id - b.id);
  } catch {
    return [];
  }
}

/** Primary image URL for a product, or null. */
export function getPrimaryImage(productId: number): ProductImage | null {
  const images = getProductImages(productId);
  return images[0] ?? null;
}

export type CouponPreview =
  | { valid: true; discountPaise: number }
  | { valid: false; reason: string };

/**
 * Pure coupon math (percent capped at 50%, flat capped at subtotal).
 * Exported for unit tests; service validation wraps it with DB checks.
 */
export function computeCouponDiscount(
  kind: string,
  value: number,
  subtotalPaise: number
): number {
  if (subtotalPaise <= 0 || value <= 0) return 0;
  if (kind === "percent") {
    const pct = Math.min(50, Math.floor(value));
    return Math.min(subtotalPaise, Math.floor((subtotalPaise * pct) / 100));
  }
  return Math.min(subtotalPaise, Math.floor(value));
}

/**
 * Server-side coupon validation. Never trusts client math.
 * Returns invalid (not throw) for unknown/expired/inapplicable codes so the
 * caller can surface a generic message without leaking coupon internals.
 */
export function validateCouponServer(
  rawCode: string,
  subtotalPaise: number
): CouponPreview {
  const code = rawCode.trim().toUpperCase().slice(0, 24);
  if (!code) return { valid: false, reason: "Enter a coupon code." };
  if (!tableExists("coupons"))
    return { valid: false, reason: "This code is not valid for this order." };
  try {
    const row = getDb()
      .prepare("SELECT * FROM coupons WHERE code=?")
      .get(code) as
      | {
          code: string;
          kind: string;
          value: number;
          min_subtotal_paise: number;
          max_uses: number | null;
          used_count: number;
          starts_at: string | null;
          ends_at: string | null;
          is_active: number;
        }
      | undefined;
    if (!row || row.is_active !== 1)
      return { valid: false, reason: "This code is not valid for this order." };
    const now = new Date();
    if (row.starts_at && new Date(row.starts_at) > now)
      return { valid: false, reason: "This code is not valid for this order." };
    if (row.ends_at && new Date(row.ends_at) < now)
      return { valid: false, reason: "This code is not valid for this order." };
    if (row.max_uses != null && row.used_count >= row.max_uses)
      return { valid: false, reason: "This code is not valid for this order." };
    if (subtotalPaise < (row.min_subtotal_paise ?? 0))
      return { valid: false, reason: "This order does not meet the code minimum." };
    const discount = computeCouponDiscount(row.kind, row.value, subtotalPaise);
    if (discount <= 0)
      return { valid: false, reason: "This code is not valid for this order." };
    return { valid: true, discountPaise: discount };
  } catch {
    return { valid: false, reason: "Unable to check the code right now." };
  }
}

export type PublicOrder = {
  id: string;
  status: string;
  payment_status: string | null;
  dispatch_status: string | null;
  subtotal_paise: number;
  discount_paise: number | null;
  shipping_paise: number;
  tax_paise: number | null;
  shipping_method: string | null;
  total_paise: number;
  created_at: string;
  item_count: number;
};

/**
 * Redacted order lookup for public tracking: no name/email/address ever.
 * Works with baseline schema and with 005/006/007 columns when present.
 *
 * Enumeration hardening (deliberate): prefix fallback requires ≥ 8 leading
 * characters (the reference printed on the confirmation), never 4. A 4-hex
 * prefix has only 65,536 possibilities — trivially enumerable even behind a
 * rate limiter — while 8 hex chars need 4.3B probes per target. Exact UUIDs
 * always work; the prefix path is a UX convenience, not an oracle: misses
 * and hits return the same generic shapes as the route layer.
 */
export function getPublicOrder(id: string): PublicOrder | null {
  const raw = id.trim().slice(0, 64);
  if (!raw) return null;
  const clean = raw.replace(/^TF-/i, "");
  if (!clean) return null;

  try {
    const db = getDb();

    // 1. Check legacy orders table
    const cols = columnsOf("orders");
    const extras: string[] = [];
    if (cols.has("payment_status")) extras.push("payment_status");
    if (cols.has("dispatch_status")) extras.push("dispatch_status");
    if (cols.has("discount_paise")) extras.push("discount_paise");
    if (cols.has("coupon_code")) extras.push("coupon_code");
    if (cols.has("tax_paise")) extras.push("tax_paise");
    if (cols.has("shipping_method")) extras.push("shipping_method");
    const row = db
      .prepare(
        `SELECT id, status, subtotal_paise, shipping_paise, total_paise, created_at${extras.length ? ", " + extras.join(", ") : ""} FROM orders WHERE id=? OR id=?`
      )
      .get(clean, raw) as Record<string, number | string> | undefined;
    const found =
      row ??
      (clean.length >= 8
        ? (db
            .prepare(
              `SELECT id, status, subtotal_paise, shipping_paise, total_paise, created_at${extras.length ? ", " + extras.join(", ") : ""} FROM orders WHERE id LIKE ? OR id LIKE ? ORDER BY created_at DESC LIMIT 1`
            )
            .get(clean + "%", raw + "%") as Record<string, number | string> | undefined)
        : undefined);

    if (found) {
      const orderId = String(found.id);
      let itemCount = 0;
      try {
        const c = db
          .prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id=?")
          .get(orderId) as { n: number };
        itemCount = c.n ?? 0;
      } catch {
        itemCount = 0;
      }
      return {
        id: orderId,
        status: String(found.status),
        payment_status: found.payment_status ? String(found.payment_status) : null,
        dispatch_status: found.dispatch_status ? String(found.dispatch_status) : null,
        subtotal_paise: Number(found.subtotal_paise ?? 0),
        discount_paise:
          found.discount_paise != null ? Number(found.discount_paise) : null,
        shipping_paise: Number(found.shipping_paise ?? 0),
        tax_paise: found.tax_paise != null ? Number(found.tax_paise) : null,
        shipping_method: found.shipping_method ? String(found.shipping_method) : null,
        total_paise: Number(found.total_paise ?? 0),
        created_at: String(found.created_at ?? ""),
        item_count: itemCount,
      };
    }

    // 2. Check commerce_orders table (modern checkout & COD)
    const cRow = db
      .prepare(
        "SELECT id, document, payment_status, fulfillment_status, created_ms FROM commerce_orders WHERE id=? OR id=?"
      )
      .get(clean, clean.toLowerCase()) as {
        id: string;
        document: string;
        payment_status: string;
        fulfillment_status: string;
        created_ms: number;
      } | undefined;

    const cFound =
      cRow ??
      (clean.length >= 8
        ? (db
            .prepare(
              "SELECT id, document, payment_status, fulfillment_status, created_ms FROM commerce_orders WHERE id LIKE ? ORDER BY created_ms DESC LIMIT 1"
            )
            .get(clean.toLowerCase() + "%") as {
              id: string;
              document: string;
              payment_status: string;
              fulfillment_status: string;
              created_ms: number;
            } | undefined)
        : undefined);

    if (cFound) {
      let doc: Record<string, unknown> = {};
      try {
        doc = JSON.parse(cFound.document) as Record<string, unknown>;
      } catch {}
      const rawLines = Array.isArray(doc.lines) ? doc.lines : [];
      const lines = rawLines as Array<{ quantity?: number; pricePaise?: number; sku?: string; variantId?: number | string; name?: string }>;
      const itemCount = lines.reduce((sum: number, l) => sum + (Number(l.quantity) || 1), 0);
      const isConfirmed = cFound.payment_status === "paid" || cFound.payment_status === "cod_due";
      const status = isConfirmed ? "confirmed" : cFound.payment_status;
      const components = (doc.components || {}) as Record<string, unknown>;
      const input = (doc.input || {}) as Record<string, unknown>;

      return {
        id: String(cFound.id),
        status,
        payment_status: cFound.payment_status ? String(cFound.payment_status) : null,
        dispatch_status: cFound.fulfillment_status ? String(cFound.fulfillment_status) : null,
        subtotal_paise: Number(doc.subtotalPaise ?? components.merchandise ?? 0),
        discount_paise: doc.discountPaise != null ? Number(doc.discountPaise) : null,
        shipping_paise: Number(doc.shippingPaise ?? components.shipping ?? 0),
        tax_paise: doc.taxPaise != null ? Number(doc.taxPaise) : null,
        shipping_method: input.method ? String(input.method) : "standard",
        total_paise: Number(doc.totalPaise ?? doc.totalMinor ?? 0),
        created_at: new Date(Number(cFound.created_ms)).toISOString(),
        item_count: itemCount,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Retrieves non-PII item list for an order to populate client purchase tracking events.
 * Strictly avoids customer names, addresses, or phone numbers.
 */
export function getPublicOrderTrackingItems(orderId: string): TrackingItem[] {
  const raw = orderId.trim().slice(0, 64);
  if (!raw) return [];
  const clean = raw.replace(/^TF-/i, "");

  try {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT 
          COALESCE(v.sku, CAST(v.id AS TEXT)) AS item_id,
          p.name AS item_name,
          p.category AS item_category,
          oi.unit_price_paise,
          oi.quantity
        FROM order_items oi
        JOIN variants v ON v.id = oi.variant_id
        JOIN products p ON p.id = v.product_id
        WHERE oi.order_id = ? OR oi.order_id = ?
      `)
      .all(clean, raw) as Array<{
        item_id: string;
        item_name: string;
        item_category: string;
        unit_price_paise: number;
        quantity: number;
      }>;

    if (rows.length > 0) {
      return rows.map((r) => ({
        item_id: r.item_id,
        item_name: r.item_name,
        item_category: r.item_category,
        price: r.unit_price_paise / 100,
        quantity: r.quantity,
      }));
    }

    // Check commerce_orders
    const commOrder = db
      .prepare("SELECT document FROM commerce_orders WHERE id=? OR id LIKE ?")
      .get(clean, clean.toLowerCase() + "%") as { document: string } | undefined;
    if (commOrder) {
      const doc = JSON.parse(commOrder.document) as Record<string, unknown>;
      const rawLines = Array.isArray(doc.lines) ? doc.lines : [];
      const lines = rawLines as Array<{ sku?: string; variantId?: number | string; name?: string; pricePaise?: number; quantity?: number }>;
      return lines.map((l) => ({
        item_id: l.sku || String(l.variantId),
        item_name: l.name || "Single-Estate Himalayan Tea",
        item_category: "Tea",
        price: Number(l.pricePaise || 0) / 100,
        quantity: Number(l.quantity || 1),
      }));
    }

    return [];
  } catch {
    return [];
  }
}

