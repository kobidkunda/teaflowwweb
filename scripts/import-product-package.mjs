#!/usr/bin/env node
/**
 * Bulk product-package importer — drives the ADMIN API (same save path as the
 * GUI form: /api/admin/products → upsertProduct, which is also the core the
 * MCP product tools call). No local source imports: pure Node + fetch, so it
 * targets local dev or production with equal fidelity.
 *
 * Package format: { "products": [ {
 *   slug*, name*, category | category_id, status, price | price_paise,
 *   stock | inventory, ingredients, description, tasting_notes,
 *   aroma_tags[], floral/fruity/malty/body/sweetness/earthy (0-5),
 *   dry_leaf_grade/appearance/aroma, liquor_hue_hex/name/clarity/body,
 *   wet_leaf_aroma/oxidation, brew_temp/brew_seconds/leaf_dose_grams/
 *   water_ml/steep_count/steep_instructions, origin/verified_origin/estate/
 *   flush/harvest_date/elevation_feet/elevation_display/lot_number/cultivar/
 *   estate_story, featured, seo_title/seo_description/canonical_override/noindex,
 *   variants: [{ sku*, grams, packaging_format, price|price_paise,
 *     compare_at_price_paise|mrp_paise|mrp_inr|mrp (null clears, omitted preserves),
 *     stock|inventory, servings }],
 *   images: [{ url*, alt_text* (mandatory), sort_order, is_primary }]
 * } ] } — see scripts/product-package.template.json.
 *
 *   node scripts/import-product-package.mjs pkg.json            → validate + dry-run (writes NOTHING)
 *   node scripts/import-product-package.mjs pkg.json --apply    → validate + apply + read-back verify
 *
 * Env: BASE_URL (default http://localhost:3000),
 *      ADMIN_IMPORT_USER + ADMIN_IMPORT_PASS (admin login for the target).
 * Upserts are idempotent by slug/SKU: re-running is safe.
 * Exit codes: 0 ok/verified · 2 validation/dry-run-blocked · 3 apply/verify failures.
 */
import fs from "node:fs";

const args = process.argv.slice(2);
const pkgPath = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

if (!pkgPath) {
  console.error("Usage: node scripts/import-product-package.mjs <package.json> [--apply]");
  console.error("Env: BASE_URL, ADMIN_IMPORT_USER, ADMIN_IMPORT_PASS");
  process.exit(2);
}

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

// ---------- 1. Load ----------
let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
} catch (e) {
  console.error(`Cannot read/parse ${pkgPath}: ${e.message}`);
  process.exit(2);
}
if (pkg && typeof pkg === "object" && !Array.isArray(pkg)) delete pkg._help;
const list = Array.isArray(pkg) ? pkg : pkg?.products;
if (!Array.isArray(list) || list.length === 0) {
  console.error("Package must be { products: [...] } with at least one product.");
  process.exit(2);
}
if (list.length > 500) {
  console.error("Package exceeds 500 products per run.");
  process.exit(2);
}

let cookie = "";
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, data, text, headers: res.headers };
}

// ---------- 2. Validate (writes nothing) ----------
const SLUG_RE = /^[a-z0-9-]{3,80}$/;
const seenSlugs = new Set();
const seenSkus = new Map(); // sku -> product ref

function num(v) {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

list.forEach((p, i) => {
  const ref = `products[${i}]${p?.slug ? ` (${p.slug})` : ""}`;
  if (!p || typeof p !== "object") return err(`products[${i}]`, "must be an object");
  if (!p.slug || !SLUG_RE.test(String(p.slug))) return err(ref, "slug is required (lowercase letters, numbers, hyphens, 3-80 chars)");
  if (seenSlugs.has(p.slug)) return err(ref, "duplicate slug within package");
  seenSlugs.add(p.slug);
  if (!p.name || String(p.name).trim().length < 2) err(ref, "name is required (min 2 chars)");
  if (p.status !== undefined && !["draft", "published", "archived"].includes(p.status)) err(ref, "status must be draft|published|archived");
  for (const k of ["floral", "fruity", "malty", "body", "sweetness", "earthy"]) {
    if (p[k] !== undefined && (!Number.isInteger(Number(p[k])) || Number(p[k]) < 0 || Number(p[k]) > 5)) err(ref, `${k} must be an integer 0-5`);
  }
  if (p.brew_temp !== undefined && (Number(p.brew_temp) < 50 || Number(p.brew_temp) > 100)) err(ref, "brew_temp must be 50-100 (shared GUI/API rule)");
  if (p.aroma_tags !== undefined && !Array.isArray(p.aroma_tags)) err(ref, "aroma_tags must be an array of strings");
  if (p.variants !== undefined && !Array.isArray(p.variants)) err(ref, "variants must be an array");

  const variants = Array.isArray(p.variants) ? p.variants : [];
  let allZeroStock = variants.length > 0;
  let allSamePrice = true;
  let firstPrice = null;
  variants.forEach((v, j) => {
    const vref = `${ref} variants[${j}]`;
    if (!v || typeof v !== "object") return err(vref, "must be an object");
    const sku = String(v.sku || "").trim().toUpperCase();
    if (!sku || !/^[A-Z0-9-]{3,24}$/.test(sku)) return err(vref, "sku required (A-Z, 0-9, hyphens, 3-24 chars)");
    if (seenSkus.has(sku)) return err(vref, `duplicate SKU in package (also in ${seenSkus.get(sku)})`);
    seenSkus.set(sku, ref);
    const price = v.price_paise !== undefined ? num(v.price_paise) : num(v.price !== undefined ? v.price : v.price_inr);
    if (price === undefined || Number.isNaN(price) || price < 0) { err(vref, "price or price_paise required (non-negative)"); return; }
    const pricePaise = v.price_paise !== undefined ? Math.round(price) : Math.round(price * 100);
    if (firstPrice === null) firstPrice = pricePaise; else if (firstPrice !== pricePaise) allSamePrice = false;
    const mrpRaw = v.compare_at_price_paise ?? v.mrp_paise ?? v.mrp_inr ?? v.mrp ?? v.compare_at_price;
    if (mrpRaw !== undefined && mrpRaw !== null && mrpRaw !== "") {
      const n = Number(mrpRaw);
      const mrpPaise = (v.compare_at_price_paise !== undefined || v.mrp_paise !== undefined) ? Math.round(n) : Math.round(n * 100);
      if (Number.isNaN(n) || mrpPaise < 0) err(vref, "invalid MRP amount");
      else if (mrpPaise < pricePaise) err(vref, `MRP (${mrpPaise}) below price (${pricePaise})`);
    }
    const stock = num(v.stock !== undefined ? v.stock : v.inventory);
    if (stock === undefined || Number.isNaN(stock) || !Number.isInteger(stock) || stock < 0) err(vref, "stock/inventory required (whole number ≥ 0)");
    else if (stock > 0) allZeroStock = false;
    if (v.packaging_format !== undefined && !["loose_leaf_pouch", "luxury_tin", "pyramid_bags"].includes(v.packaging_format)) err(vref, "packaging_format must be loose_leaf_pouch|luxury_tin|pyramid_bags");
  });
  if (variants.length === 0) warn(ref, "no variants — product will be created without SKUs (storefront needs at least one purchasable variant)");
  if (variants.length > 0 && allZeroStock) warn(ref, "all variants zero stock — will show as out of stock if published");
  if (variants.length > 1 && allSamePrice) warn(ref, `all ${variants.length} variants share one price — confirm placeholder pricing is intentional`);
  if ((p.status || "published") === "published" && (!p.description || !String(p.description).trim())) warn(ref, "published with blank description");
  if (Array.isArray(p.images)) {
    p.images.forEach((img, j) => {
      if (!img?.url || !String(img.url).trim()) err(`${ref} images[${j}]`, "url is required");
      if (!img?.alt_text || !String(img.alt_text).trim()) err(`${ref} images[${j}]`, "alt_text is mandatory");
    });
  }
});

if (errors.length > 0) {
  console.error(`\nVALIDATION FAILED — ${errors.length} problem(s), nothing was written:\n`);
  errors.forEach((e) => console.error("  ✗ " + e));
  process.exit(2);
}
console.log(`\nValidation passed for ${list.length} product(s), ${seenSkus.size} variant SKU(s).`);
if (warnings.length > 0) {
  console.log(`Warnings (${warnings.length}):`);
  warnings.forEach((w) => console.log("  ! " + w));
}
if (!APPLY) {
  console.log("\nDry run only — nothing was written. Re-run with --apply to import.");
  process.exit(0);
}

// ---------- 3. Apply via Admin API ----------
const IMPORT_USER = process.env.ADMIN_IMPORT_USER;
const IMPORT_PASS = process.env.ADMIN_IMPORT_PASS;
if (!IMPORT_USER || !IMPORT_PASS) {
  console.error("Set ADMIN_IMPORT_USER and ADMIN_IMPORT_PASS for the target admin account.");
  process.exit(2);
}
// Single login: fetch() does not persist cookies, so capture set-cookie.
{
  const login = await api("POST", "/api/admin/login", { username: IMPORT_USER, password: IMPORT_PASS });
  if (login.status !== 200) {
    console.error(`Login failed (${login.status}): ${(login.data && login.data.error) || "check ADMIN_IMPORT_USER/PASS"}`);
    process.exit(3);
  }
  const setCookie = login.headers.get("set-cookie") || "";
  const m = setCookie.match(/([^=;,]+=[^;,]+)/);
  if (m) cookie = m[1];
  if (!cookie) { console.error("Login did not return a session cookie."); process.exit(3); }
}

let applied = 0;
const failures = [];
for (const p of list) {
  const ref = p.slug;
  try {
    // CREATE-or-UPDATE by slug: list and match exactly (q-search semantics
    // vary; the catalogue is small so a full list + exact match is exact).
    const probe = await api("GET", "/api/admin/products?limit=100&status=all");
    const found = probe.status === 200 && Array.isArray(probe.data.products)
      ? probe.data.products.find((x) => x.slug === p.slug) : null;
    let res;
    if (found) res = await api("PUT", `/api/admin/products/${found.id}`, p);
    else res = await api("POST", "/api/admin/products", p);
    if (res.status !== 200 && res.status !== 201) {
      failures.push(`${ref}: HTTP ${res.status} — ${(res.data && (res.data.error || JSON.stringify(res.data.detail))) || res.text.slice(0, 200)}`);
      continue;
    }
    const id = (res.data && (res.data.id || (res.data.product && res.data.product.id))) || (found && found.id);
    // Read-back verify: every package field present in the response/store.
    const verify = await api("GET", `/api/admin/products/${id}`);
    if (verify.status !== 200 || !verify.data.product) { failures.push(`${ref}: applied but re-read failed`); continue; }
    const vp = verify.data.product;
    const diffs = [];
    for (const k of ["name", "status", "ingredients", "description", "estate", "origin", "flush", "lot_number", "seo_title"]) {
      if (p[k] !== undefined && String(vp[k] ?? "") !== String(p[k])) diffs.push(k);
    }
    if (Array.isArray(p.variants)) {
      if ((vp.variants || []).length !== p.variants.length) diffs.push(`variant count ${(vp.variants || []).length} ≠ ${p.variants.length}`);
      const bySku = new Map((vp.variants || []).map((v) => [v.sku, v]));
      for (const v of p.variants) {
        const sku = String(v.sku).trim().toUpperCase();
        const got = bySku.get(sku);
        if (!got) { diffs.push(`variant ${sku} missing`); continue; }
        const wantPrice = v.price_paise !== undefined ? Math.round(Number(v.price_paise)) : Math.round(Number(v.price ?? v.price_inr) * 100);
        if (got.price_paise !== wantPrice) diffs.push(`variant ${sku} price`);
        const wantStock = Number(v.stock !== undefined ? v.stock : v.inventory);
        if (got.stock !== wantStock) diffs.push(`variant ${sku} stock`);
        const mrpRaw = v.compare_at_price_paise ?? v.mrp_paise ?? v.mrp_inr ?? v.mrp ?? v.compare_at_price;
        const wantMrp = mrpRaw === undefined ? undefined
          : (mrpRaw === null || mrpRaw === "" ? null
            : ((v.compare_at_price_paise !== undefined || v.mrp_paise !== undefined) ? Math.round(Number(mrpRaw)) : Math.round(Number(mrpRaw) * 100)));
        if (wantMrp !== undefined && got.compare_at_price_paise !== wantMrp) diffs.push(`variant ${sku} mrp`);
      }
    }
    if (Array.isArray(p.images)) {
      const gotImages = vp.images || [];
      if (gotImages.length !== p.images.length) diffs.push(`image count ${gotImages.length} !== ${p.images.length}`);
      for (const img of p.images) {
        const hit = gotImages.find((g) => g.url === img.url);
        if (!hit) diffs.push(`image ${img.url} missing`);
        else if (img.alt_text && hit.alt_text !== img.alt_text) diffs.push(`image ${img.url} alt mismatch`);
      }
    }
    if (diffs.length > 0) { failures.push(`${ref}: read-back mismatch — ${diffs.join(", ")}`); continue; }
    applied++;
    console.log(`  ✓ ${ref} (${found ? "updated" : "created"}): verified`);
  } catch (e) {
    failures.push(`${ref}: ${e.message}`);
  }
}

console.log(`\nApplied + verified: ${applied}/${list.length}`);
if (failures.length > 0) {
  console.error("Failures:");
  failures.forEach((f) => console.error("  ✗ " + f));
  process.exit(3);
}
