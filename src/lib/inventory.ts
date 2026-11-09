import { getDb } from "@/lib/db";
import { idempotent } from "@/lib/adminStore";
import { MAX_INVENTORY_QTY } from "@/lib/validation";
import type { Variant } from "@/lib/productModels";

export interface InventoryUpdateResult {
  product: { id: number; slug: string; name: string };
  variants: Pick<Variant, "id" | "sku" | "stock">[];
  updated: number;
  quantity: number;
  createdDefaultVariant: boolean;
}

export interface InventoryUpdateParams {
  product?: string | number;
  sku?: string;
  variantId?: number;
  quantity: number;
  idempotencyKey?: string;
}

function resolveProductId(product: string | number): { id: number; slug: string; name: string } | null {
  const db = getDb();
  if (typeof product === "number" && Number.isFinite(product) && product > 0) {
    const row = db.prepare("SELECT id, slug, name FROM products WHERE id=?").get(Math.round(product)) as
      | { id: number; slug: string; name: string }
      | undefined;
    return row ?? null;
  }
  const text = String(product).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    const row = db.prepare("SELECT id, slug, name FROM products WHERE id=?").get(Number(text)) as
      | { id: number; slug: string; name: string }
      | undefined;
    if (row) return row;
  }
  const row = db.prepare("SELECT id, slug, name FROM products WHERE slug=?").get(text) as
    | { id: number; slug: string; name: string }
    | undefined;
  return row ?? null;
}

function buildDefaultSku(slug: string): string {
  const prefix = slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 16) || "TEA";
  return `${prefix}-100G`.slice(0, 24);
}

/**
 * Sets inventory to an exact quantity (not a delta).
 *
 * - sku: updates the single variant with that SKU.
 * - variantId: updates the single variant with that numeric ID.
 * - product (id or slug): updates ALL variants of the product; when the
 *   product has no variants, creates one default 100g pouch variant so the
 *   product reports the requested total.
 * - When sku/variantId and product are combined, the variant must belong to
 *   the given product, otherwise the update is rejected.
 *
 * All SQL is parameterized. Exact-set replays are naturally idempotent;
 * an optional idempotencyKey additionally replays the stored response.
 */
export function updateInventoryStock(params: InventoryUpdateParams): { body: InventoryUpdateResult; deduped: boolean } {
  const quantity = Math.round(Number(params.quantity));
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > MAX_INVENTORY_QTY) {
    throw new Error("Quantity must be an integer between 0 and 999999.");
  }
  const sku = params.sku !== undefined ? String(params.sku).trim().toUpperCase().slice(0, 30) : undefined;
  const variantId = params.variantId !== undefined ? Math.round(Number(params.variantId)) : undefined;
  if (!sku && !variantId && params.product === undefined) {
    throw new Error("Either product, sku, or variantId is required.");
  }

  return idempotent("inventory", params.idempotencyKey, () => {
    const db = getDb();

    // Single-variant modes (sku / variantId).
    let targetVariant: { id: number; product_id: number; sku: string } | undefined;
    if (sku) {
      targetVariant = db.prepare("SELECT id, product_id, sku FROM variants WHERE sku=?").get(sku) as
        | { id: number; product_id: number; sku: string }
        | undefined;
      if (!targetVariant) throw new Error("Variant not found.");
    } else if (variantId) {
      if (!Number.isFinite(variantId) || variantId <= 0) throw new Error("Variant not found.");
      targetVariant = db.prepare("SELECT id, product_id, sku FROM variants WHERE id=?").get(variantId) as
        | { id: number; product_id: number; sku: string }
        | undefined;
      if (!targetVariant) throw new Error("Variant not found.");
    }

    if (targetVariant) {
      if (params.product !== undefined) {
        const prod = resolveProductId(params.product);
        if (!prod) throw new Error("Product not found.");
        if (targetVariant.product_id !== prod.id) {
          throw new Error("The SKU does not belong to the given product.");
        }
      }
      db.prepare("UPDATE variants SET stock=? WHERE id=?").run(quantity, targetVariant.id);
      const prod = db.prepare("SELECT id, slug, name FROM products WHERE id=?").get(targetVariant.product_id) as {
        id: number;
        slug: string;
        name: string;
      };
      return {
        product: prod,
        variants: [{ id: targetVariant.id, sku: targetVariant.sku, stock: quantity }],
        updated: 1,
        quantity,
        createdDefaultVariant: false,
      } satisfies InventoryUpdateResult;
    }

    // Product mode.
    const prod = resolveProductId(params.product as string | number);
    if (!prod) throw new Error("Product not found.");
    return db.transaction(() => {
      const rows = db.prepare("SELECT id, sku FROM variants WHERE product_id=? ORDER BY id ASC").all(prod.id) as {
        id: number;
        sku: string;
      }[];
      if (rows.length === 0) {
        let candidate = buildDefaultSku(prod.slug);
        const taken = db.prepare("SELECT id, product_id FROM variants WHERE sku=?").get(candidate) as
          | { id: number; product_id: number }
          | undefined;
        if (taken && taken.product_id !== prod.id) {
          const alt = `${candidate.slice(0, 21)}-2`.slice(0, 24);
          candidate = (db.prepare("SELECT id FROM variants WHERE sku=?").get(alt) ? `${candidate.slice(0, 20)}-3` : alt).slice(0, 24);
        }
        const info = db.prepare(
          "INSERT INTO variants (product_id, sku, grams, price_paise, stock, packaging_format, servings) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(prod.id, candidate, 100, 19900, quantity, "loose_leaf_pouch", 50);
        const newId = Number(info.lastInsertRowid);
        const created: Pick<Variant, "id" | "sku" | "stock"> = Number.isFinite(newId) && newId > 0
          ? { id: newId, sku: candidate, stock: quantity }
          : (() => {
              const found = db.prepare("SELECT id, sku, stock FROM variants WHERE sku=?").get(candidate) as {
                id: number;
                sku: string;
                stock: number;
              };
              return { id: found.id, sku: found.sku, stock: found.stock };
            })();
        return {
          product: prod,
          variants: [created],
          updated: 1,
          quantity,
          createdDefaultVariant: true,
        } satisfies InventoryUpdateResult;
      }
      db.prepare("UPDATE variants SET stock=? WHERE product_id=?").run(quantity, prod.id);
      return {
        product: prod,
        variants: rows.map((r) => ({ id: r.id, sku: r.sku, stock: quantity })),
        updated: rows.length,
        quantity,
        createdDefaultVariant: false,
      } satisfies InventoryUpdateResult;
    })();
  });
}
