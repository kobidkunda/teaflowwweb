import { z } from "zod";
import { getDb } from "@/lib/db";
import { GST_RATE_PERCENT } from "@/lib/money";
import { idempotent } from "@/lib/adminStore";

/**
 * Bulk pricing CSV update (admin).
 *
 * Flow: download template → edit price/mrp/stock in a spreadsheet →
 * upload → server verifies + previews → submit pushes live.
 *
 * Editable columns: price_inr, mrp_inr, stock.
 * Identity columns: variant_id, sku (sku must match the stored variant).
 * Informational columns (ignored on upload, recomputed): product_name,
 * product_slug, grams, packaging_format, discount_percent,
 * gst_rate_percent, gst_amount_inr. Prices are GST-INCLUSIVE.
 */

export const BULK_PRICING_COLUMNS = [
  "variant_id",
  "sku",
  "product_name",
  "product_slug",
  "grams",
  "packaging_format",
  "price_inr",
  "mrp_inr",
  "discount_percent",
  "stock",
  "gst_rate_percent",
  "gst_amount_inr",
] as const;

export const BULK_PRICING_REQUIRED_HEADERS = ["variant_id", "sku", "price_inr", "stock"] as const;

export const MAX_BULK_ROWS = 1000;
export const MAX_CSV_BYTES = 1024 * 1024; // 1 MiB
export const MAX_PRICE_PAISE = 10000000; // ₹1,00,000 — catches decimal typos
export const MAX_STOCK = 999999;

export interface BulkPricingDatasetRow {
  variant_id: number;
  sku: string;
  product_name: string;
  product_slug: string;
  grams: number;
  packaging_format: string;
  price_paise: number;
  compare_at_price_paise: number | null;
  stock: number;
}

export interface BulkFieldError {
  row: number; // 1-based CSV line number (header = 1)
  variant_id: number | null;
  sku: string | null;
  field: string;
  message: string;
}

export interface BulkChange {
  variant_id: number;
  sku: string;
  product_name: string;
  grams: number;
  packaging_format: string;
  oldPricePaise: number;
  newPricePaise: number;
  oldMrpPaise: number | null;
  newMrpPaise: number | null;
  oldStock: number;
  newStock: number;
  oldDiscountPct: number;
  newDiscountPct: number;
  fields: string[]; // subset of ["price_inr","mrp_inr","stock"]
  warnings: string[];
}

export interface BulkPreview {
  totalRows: number;
  changeCount: number;
  unchangedCount: number;
  errorCount: number;
  errors: BulkFieldError[];
  changes: BulkChange[];
  gstRatePercent: number;
}

/** Read the effective GST rate from store settings, falling back to the code constant. */
export function getEffectiveGstRatePercent(): number {
  try {
    const db = getDb();
    const hasTable = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='store_settings'")
      .get() as { 1: number } | undefined;
    if (!hasTable) return GST_RATE_PERCENT;
    const rows = db.prepare("SELECT key, value FROM store_settings").all() as Array<{
      key: string;
      value: string;
    }>;
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const raw = map.get("tax_rate_percent") ?? map.get("gst_tax_rate_percent") ?? String(GST_RATE_PERCENT);
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) return GST_RATE_PERCENT;
    return n;
  } catch {
    return GST_RATE_PERCENT;
  }
}

export function discountPercent(pricePaise: number, mrpPaise: number | null): number {
  if (mrpPaise == null || mrpPaise <= 0 || mrpPaise <= pricePaise) return 0;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
}

/** GST portion already inside a GST-inclusive price, formatted with 2 decimals. */
export function gstAmountInr(pricePaise: number, ratePercent: number): string {
  if (!Number.isInteger(pricePaise) || pricePaise <= 0 || ratePercent <= 0) return "0.00";
  const amt = (pricePaise * ratePercent) / (100 + ratePercent) / 100;
  return amt.toFixed(2);
}

export function paiseToInrString(paise: number): string {
  const inr = paise / 100;
  return Number.isInteger(inr) ? String(inr) : inr.toFixed(2);
}

/** RFC 4180 field escape: quote when the value holds a quote, comma or newline. */
export function escapeBulkCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Minimal RFC 4180 parser: handles quoted fields, doubled quotes, commas and
 * newlines inside quotes, CRLF/LF/CR line endings and a leading UTF-8 BOM.
 * Returns rows of raw cell strings (no trimming — callers trim per field).
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;

  const pushField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };
  const pushRow = () => {
    pushField();
    // Skip fully blank lines (e.g. trailing newline, spreadsheet gaps).
    if (!(row.length === 1 && row[0] === "") && !row.every((c) => c === "")) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }
    if (ch === ",") {
      pushField();
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      pushRow();
      continue;
    }
    field += ch;
    if (ch !== " " && ch !== "\t") fieldStarted = fieldStarted || true;
    else if (field.length > 0) fieldStarted = true;
  }
  // Flush trailing content (a file without a final newline still holds a row).
  if (field !== "" || row.length > 0) pushRow();
  if (inQuotes) {
    // Unclosed quote: treat the remainder as the final field value anyway,
    // validation will flag anything nonsensical per field.
  }
  return rows;
}

export function buildBulkPricingCsv(rows: BulkPricingDatasetRow[], gstRate: number): string {
  const header = BULK_PRICING_COLUMNS.join(",");
  const lines = rows.map((r) =>
    [
      r.variant_id,
      r.sku,
      r.product_name,
      r.product_slug,
      r.grams,
      r.packaging_format,
      paiseToInrString(r.price_paise),
      r.compare_at_price_paise == null ? "" : paiseToInrString(r.compare_at_price_paise),
      discountPercent(r.price_paise, r.compare_at_price_paise),
      r.stock,
      gstRate,
      gstAmountInr(r.price_paise, gstRate),
    ]
      .map(escapeBulkCsvField)
      .join(",")
  );
  return [header, ...lines].join("\r\n") + "\r\n";
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Strip currency symbols, codes and thousand separators so Excel edits parse. */
function cleanMoneyString(raw: string): string {
  return raw
    .trim()
    .replace(/[₹$]/g, "")
    .replace(/\b(rs|inr)\b\.?/gi, "")
    .replace(/,/g, "")
    .trim();
}

function parseMoneyToPaise(
  raw: string,
  opts: { allowEmpty: boolean; field: string }
): { paise: number | null; error: string | null } {
  const cleaned = cleanMoneyString(raw);
  if (cleaned === "") {
    if (opts.allowEmpty) return { paise: null, error: null };
    return { paise: null, error: "Required — enter a price such as 199 or 199.50." };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { paise: null, error: "Enter a non-negative amount with at most 2 decimals (e.g. 199.50)." };
  }
  const paise = Math.round(Number(cleaned) * 100);
  if (!Number.isFinite(paise) || paise <= 0) {
    return { paise: null, error: "Price must be greater than ₹0." };
  }
  if (paise > MAX_PRICE_PAISE) {
    return { paise: null, error: `Price exceeds the ₹${Math.round(MAX_PRICE_PAISE / 100).toLocaleString("en-IN")} per-SKU limit — check for a decimal typo.` };
  }
  return { paise, error: null };
}

function parseStock(raw: string): { stock: number | null; error: string | null } {
  const cleaned = raw.trim().replace(/,/g, "");
  if (cleaned === "") return { stock: null, error: "Required — enter a whole number (0 or more)." };
  if (!/^\d+$/.test(cleaned)) {
    return { stock: null, error: "Enter a whole number of units (0 or more, no decimals)." };
  }
  const n = Number(cleaned);
  if (!Number.isSafeInteger(n) || n < 0) {
    return { stock: null, error: "Enter a whole number of units (0 or more, no decimals)." };
  }
  if (n > MAX_STOCK) {
    return { stock: null, error: `Stock exceeds the ${MAX_STOCK.toLocaleString("en-IN")} unit limit.` };
  }
  return { stock: n, error: null };
}

/** All live variants with product context for template + preview comparison. */
export function getBulkPricingDataset(): BulkPricingDatasetRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT v.id AS variant_id, v.sku AS sku,
              COALESCE(p.name, '') AS product_name, COALESCE(p.slug, '') AS product_slug,
              v.grams AS grams, COALESCE(v.packaging_format, 'loose_leaf_pouch') AS packaging_format,
              v.price_paise AS price_paise, v.compare_at_price_paise AS compare_at_price_paise,
              v.stock AS stock
       FROM variants v LEFT JOIN products p ON v.product_id = p.id
       ORDER BY p.name ASC, v.grams ASC, v.id ASC LIMIT 2000`
    )
    .all() as Array<{
    variant_id: number;
    sku: string;
    product_name: string;
    product_slug: string;
    grams: number;
    packaging_format: string;
    price_paise: number;
    compare_at_price_paise: number | null;
    stock: number;
  }>;
  return rows.map((r) => ({
    variant_id: Number(r.variant_id),
    sku: String(r.sku ?? ""),
    product_name: String(r.product_name ?? ""),
    product_slug: String(r.product_slug ?? ""),
    grams: Number(r.grams ?? 0),
    packaging_format: String(r.packaging_format ?? "loose_leaf_pouch"),
    price_paise: Number(r.price_paise ?? 0),
    compare_at_price_paise: r.compare_at_price_paise == null ? null : Number(r.compare_at_price_paise),
    stock: Number(r.stock ?? 0),
  }));
}

function changeWarnings(args: {
  oldPricePaise: number;
  newPricePaise: number;
  oldMrpPaise: number | null;
  newMrpPaise: number | null;
  oldStock: number;
  newStock: number;
  newDiscountPct: number;
}): string[] {
  const warnings: string[] = [];
  const { oldPricePaise, newPricePaise, oldMrpPaise, newMrpPaise, oldStock, newStock, newDiscountPct } = args;
  if (oldPricePaise > 0 && newPricePaise !== oldPricePaise) {
    const pct = Math.round(((newPricePaise - oldPricePaise) / oldPricePaise) * 100);
    if (pct <= -30) warnings.push(`Price drops ${Math.abs(pct)}% — please confirm this is intentional.`);
    else if (pct >= 30) warnings.push(`Price rises ${pct}% — please confirm this is intentional.`);
  }
  if (newDiscountPct > 60) warnings.push(`Deep discount of ${newDiscountPct}% — please confirm the MRP.`);
  if (oldStock > 0 && newStock === 0) warnings.push("Stock becomes 0 — this SKU will show as out of stock.");
  if (oldMrpPaise != null && newMrpPaise == null) warnings.push("MRP cleared — the discount badge will be removed.");
  else if (newMrpPaise != null && newMrpPaise === newPricePaise)
    warnings.push("MRP equals price — no discount badge will show.");
  return warnings;
}

/**
 * Pure preview core: compares parsed CSV rows against a supplied dataset.
 * The DB-backed previewBulkPricing() wrapper below feeds the live dataset.
 */
export function previewBulkPricingFromRows(
  existing: BulkPricingDatasetRow[],
  csvText: string,
  gstRate: number
): BulkPreview {
  const errors: BulkFieldError[] = [];
  const changes: BulkChange[] = [];
  const byId = new Map(existing.map((r) => [r.variant_id, r]));
  const seen = new Set<number>();

  if (!csvText || !csvText.trim()) {
    return {
      totalRows: 0,
      changeCount: 0,
      unchangedCount: 0,
      errorCount: 1,
      errors: [{ row: 1, variant_id: null, sku: null, field: "file", message: "The uploaded file is empty." }],
      changes,
      gstRatePercent: gstRate,
    };
  }

  const table = parseCsv(csvText);
  if (table.length === 0) {
    return {
      totalRows: 0,
      changeCount: 0,
      unchangedCount: 0,
      errorCount: 1,
      errors: [{ row: 1, variant_id: null, sku: null, field: "file", message: "No rows found in the uploaded file." }],
      changes,
      gstRatePercent: gstRate,
    };
  }

  const headers = table[0].map(normalizeHeader);
  const colIndex = new Map(headers.map((h, i) => [h, i] as [string, number]));
  // First occurrence wins for duplicated headers.
  for (let i = 0; i < headers.length; i++) {
    if (!colIndex.has(headers[i])) colIndex.set(headers[i], i);
  }

  const missing = BULK_PRICING_REQUIRED_HEADERS.filter((h) => !colIndex.has(h));
  if (missing.length > 0) {
    return {
      totalRows: 0,
      changeCount: 0,
      unchangedCount: 0,
      errorCount: missing.length,
      errors: missing.map((h) => ({
        row: 1,
        variant_id: null,
        sku: null,
        field: h,
        message: `Missing required column “${h}”. Download a fresh template and keep its header row intact.`,
      })),
      changes,
      gstRatePercent: gstRate,
    };
  }

  const cell = (cells: string[], name: string): string => {
    const idx = colIndex.get(name);
    if (idx == null || idx >= cells.length) return "";
    return cells[idx] ?? "";
  };
  const hasMrpColumn = colIndex.has("mrp_inr");
  let unchangedCount = 0;
  let dataRowCount = 0;

  for (let i = 1; i < table.length; i++) {
    const lineNo = i + 1;
    const cells = table[i];
    dataRowCount++;

    if (dataRowCount > MAX_BULK_ROWS) {
      errors.push({
        row: lineNo,
        variant_id: null,
        sku: null,
        field: "file",
        message: `Too many rows — the limit is ${MAX_BULK_ROWS} SKUs per upload. Split the file and try again.`,
      });
      break;
    }

    const rawId = cell(cells, "variant_id").trim();
    const rawSku = cell(cells, "sku").trim();
    const rawPrice = cell(cells, "price_inr");
    const rawMrp = hasMrpColumn ? cell(cells, "mrp_inr") : "";
    const rawStock = cell(cells, "stock");

    const variantId = /^\d+$/.test(rawId) ? Number(rawId) : NaN;
    if (!Number.isSafeInteger(variantId) || variantId <= 0) {
      errors.push({ row: lineNo, variant_id: null, sku: rawSku || null, field: "variant_id", message: "Enter the numeric variant_id from the template — do not change it." });
      continue;
    }

    const current = byId.get(variantId);
    if (!current) {
      errors.push({ row: lineNo, variant_id: variantId, sku: rawSku || null, field: "variant_id", message: `Unknown variant_id ${variantId} — it may have been deleted. Download a fresh template.` });
      continue;
    }
    if (!rawSku) {
      errors.push({ row: lineNo, variant_id: variantId, sku: null, field: "sku", message: "SKU is required and must match the template." });
      continue;
    }
    if (rawSku.toUpperCase() !== current.sku.toUpperCase()) {
      errors.push({
        row: lineNo,
        variant_id: variantId,
        sku: rawSku,
        field: "sku",
        message: `SKU mismatch — this row says “${rawSku}” but variant ${variantId} is “${current.sku}”. Fix the variant_id or re-download the template.`,
      });
      continue;
    }
    // Claim the id only once identity checks pass, so a broken row never
    // squats the id of a good row — each problem is reported on its own row.
    if (seen.has(variantId)) {
      errors.push({ row: lineNo, variant_id: variantId, sku: rawSku || null, field: "variant_id", message: `Duplicate row for variant_id ${variantId} — keep only one row per SKU.` });
      continue;
    }
    seen.add(variantId);

    const priceRes = parseMoneyToPaise(rawPrice, { allowEmpty: false, field: "price_inr" });
    if (priceRes.error || priceRes.paise == null) {
      errors.push({ row: lineNo, variant_id: variantId, sku: rawSku, field: "price_inr", message: priceRes.error ?? "Invalid price." });
      continue;
    }
    let newMrp: number | null | undefined;
    if (!hasMrpColumn) {
      newMrp = undefined; // column removed → leave MRP untouched
    } else {
      const mrpRes = parseMoneyToPaise(rawMrp, { allowEmpty: true, field: "mrp_inr" });
      if (mrpRes.error) {
        errors.push({ row: lineNo, variant_id: variantId, sku: rawSku, field: "mrp_inr", message: mrpRes.error });
        continue;
      }
      newMrp = mrpRes.paise;
    }
    const stockRes = parseStock(rawStock);
    if (stockRes.error || stockRes.stock == null) {
      errors.push({ row: lineNo, variant_id: variantId, sku: rawSku, field: "stock", message: stockRes.error ?? "Invalid stock." });
      continue;
    }

    const finalMrp = newMrp === undefined ? current.compare_at_price_paise : newMrp;
    if (finalMrp != null && finalMrp < priceRes.paise) {
      errors.push({
        row: lineNo,
        variant_id: variantId,
        sku: rawSku,
        field: "mrp_inr",
        message: `MRP (₹${paiseToInrString(finalMrp)}) is below the price (₹${paiseToInrString(priceRes.paise)}). MRP must be empty or at least the selling price.`,
      });
      continue;
    }

    const priceChanged = priceRes.paise !== current.price_paise;
    const mrpChanged = (finalMrp ?? null) !== (current.compare_at_price_paise ?? null);
    const stockChanged = stockRes.stock !== current.stock;
    if (!priceChanged && !mrpChanged && !stockChanged) {
      unchangedCount++;
      continue;
    }

    const fields: string[] = [];
    if (priceChanged) fields.push("price_inr");
    if (mrpChanged) fields.push("mrp_inr");
    if (stockChanged) fields.push("stock");

    changes.push({
      variant_id: variantId,
      sku: current.sku,
      product_name: current.product_name,
      grams: current.grams,
      packaging_format: current.packaging_format,
      oldPricePaise: current.price_paise,
      newPricePaise: priceRes.paise,
      oldMrpPaise: current.compare_at_price_paise,
      newMrpPaise: finalMrp ?? null,
      oldStock: current.stock,
      newStock: stockRes.stock,
      oldDiscountPct: discountPercent(current.price_paise, current.compare_at_price_paise),
      newDiscountPct: discountPercent(priceRes.paise, finalMrp ?? null),
      fields,
      warnings: changeWarnings({
        oldPricePaise: current.price_paise,
        newPricePaise: priceRes.paise,
        oldMrpPaise: current.compare_at_price_paise,
        newMrpPaise: finalMrp ?? null,
        oldStock: current.stock,
        newStock: stockRes.stock,
        newDiscountPct: discountPercent(priceRes.paise, finalMrp ?? null),
      }),
    });
  }

  if (dataRowCount === 0) {
    errors.push({ row: 1, variant_id: null, sku: null, field: "file", message: "No data rows found — the file holds only a header row." });
  }

  return {
    totalRows: dataRowCount,
    changeCount: changes.length,
    unchangedCount,
    errorCount: errors.length,
    errors,
    changes,
    gstRatePercent: gstRate,
  };
}

/** DB-backed preview: reads live variants + effective GST rate. */
export function previewBulkPricing(csvText: string): BulkPreview {
  const gstRate = getEffectiveGstRatePercent();
  return previewBulkPricingFromRows(getBulkPricingDataset(), csvText, gstRate);
}

// ---- Apply (server-validated, transactional, idempotent) ----

export const bulkPricingApplyRowSchema = z.object({
  variant_id: z.number().int().positive(),
  price_paise: z.number().int().min(1).max(MAX_PRICE_PAISE),
  compare_at_price_paise: z.number().int().min(0).max(MAX_PRICE_PAISE).nullable(),
  stock: z.number().int().min(0).max(MAX_STOCK),
});

export const bulkPricingApplySchema = z
  .object({
    rows: z.array(bulkPricingApplyRowSchema).min(1).max(MAX_BULK_ROWS),
    idempotencyKey: z.string().uuid().optional(),
  })
  .refine(
    (v) => v.rows.every((r) => r.compare_at_price_paise == null || r.compare_at_price_paise >= r.price_paise),
    { message: "MRP must be empty or at least the selling price for every row." }
  );

export type BulkPricingApplyInput = z.infer<typeof bulkPricingApplySchema>;

export interface BulkApplyResult {
  applied: number;
  variants: Array<{ variant_id: number; sku: string; price_paise: number; compare_at_price_paise: number | null; stock: number }>;
}

/**
 * Applies validated rows in one transaction (all-or-nothing). Re-validates
 * existence + MRP invariant against live data so a tampered payload cannot
 * bypass the preview checks. Never throws raw DB internals.
 */
export function applyBulkPricing(input: BulkPricingApplyInput): { body: BulkApplyResult; deduped: boolean } {
  return idempotent("bulk-pricing", input.idempotencyKey, () => {
    const db = getDb();
    const cols = (db.prepare("PRAGMA table_info(variants)").all() as Array<{ name: string }>).map((c) => c.name);
    if (!cols.includes("compare_at_price_paise")) {
      throw new Error("Discount (MRP) storage is unavailable on this database. Run migrations first.");
    }

    const seen = new Set<number>();
    for (const r of input.rows) {
      if (seen.has(r.variant_id)) throw new Error(`Duplicate row for variant ${r.variant_id}.`);
      seen.add(r.variant_id);
    }

    const run = db.transaction(() => {
      const out: BulkApplyResult["variants"] = [];
      const getStmt = db.prepare("SELECT id, sku FROM variants WHERE id=?");
      const updateStmt = db.prepare(
        "UPDATE variants SET price_paise=?, compare_at_price_paise=?, stock=? WHERE id=?"
      );
      for (const r of input.rows) {
        const found = getStmt.get(r.variant_id) as { id: number; sku: string } | undefined;
        if (!found) throw new Error(`Unknown variant ${r.variant_id}. Download a fresh template and try again.`);
        updateStmt.run(r.price_paise, r.compare_at_price_paise, r.stock, r.variant_id);
        out.push({
          variant_id: r.variant_id,
          sku: found.sku,
          price_paise: r.price_paise,
          compare_at_price_paise: r.compare_at_price_paise,
          stock: r.stock,
        });
      }
      return out;
    });

    const variants = run();
    return { applied: variants.length, variants };
  });
}
