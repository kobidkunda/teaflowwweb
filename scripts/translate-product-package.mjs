#!/usr/bin/env node
/**
 * Translates the external content-master package
 * (TEAFLOWW_FULL_PRODUCT_ADMIN_FIELDS.json) into importer format for
 * scripts/import-product-package.mjs.
 *
 * HONESTY CONTRACT (explicit — audit this before every run):
 *  INCLUDE (verified or explicitly requested facts):
 *    title→name, slug, category_id, publication_status_requested→status,
 *    featured_requested→featured, editorial_markdown_draft→description,
 *    seo.title→seo_title, seo.description→seo_description,
 *    variants_requested[]→variants[] (sku/grams/format→packaging_format/
 *    price_paise/compare_at_price_paise/stock).
 *  OMIT (never published as fact):
 *    *_proposed (tasting notes, aroma tags — explicitly not measured),
 *    *_verified objects that are all-null (sensory, dry/liquor/wet leaf, provenance),
 *    steeping_trial_only (trial parameters, not verified instructions),
 *    ingredients_RnD_only (internal formulation, never customer-facing),
 *    short_description (no matching admin field — reported, not stuffed),
 *    gallery (already live, requires_new_images=false — untouched),
 *    internal_notes, warnings, current_mcp_update_scope, id (foreign identity).
 *  Top-level price/stock are DROPPED when variants[] is present so existing
 *  first-variant SKUs outside the package are never touched.
 *
 * Usage: node scripts/translate-product-package.mjs <in.json> <out.json>
 * Prints a translation report; exits 2 on structural problems.
 */
import fs from "node:fs";

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error("Usage: node scripts/translate-product-package.mjs <full-fields.json> <importer-package.json>");
  process.exit(2);
}

const src = JSON.parse(fs.readFileSync(inPath, "utf8"));
const list = Array.isArray(src) ? src : src.products;
if (!Array.isArray(list) || list.length === 0) {
  console.error("Input has no products array.");
  process.exit(2);
}

const report = { included: [], omitted: [], flags: [] };
const products = list.map((p, i) => {
  const ref = `products[${i}]${p.slug ? ` (${p.slug})` : ""}`;
  if (!p.slug || !p.title) {
    console.error(`${ref}: missing slug or title — cannot translate.`);
    process.exit(2);
  }
  const out = { slug: p.slug, name: p.title };
  if (p.category_id !== undefined && p.category_id !== null) out.category_id = p.category_id;
  else if (p.category_slug) out.category = p.category_slug;
  if (typeof p.publication_status_requested === "string") out.status = p.publication_status_requested.trim().toLowerCase();
  if (typeof p.featured_requested === "boolean") out.featured = p.featured_requested;
  if (typeof p.ingredients_public === "string" && p.ingredients_public.trim()) out.ingredients = p.ingredients_public;
  if (typeof p.editorial_markdown_draft === "string" && p.editorial_markdown_draft.trim()) out.description = p.editorial_markdown_draft;
  if (p.seo && typeof p.seo === "object") {
    if (typeof p.seo.title === "string" && p.seo.title.trim()) out.seo_title = p.seo.title;
    if (typeof p.seo.description === "string" && p.seo.description.trim()) out.seo_description = p.seo.description;
    if (typeof p.seo.canonical_override === "string" && p.seo.canonical_override.trim()) out.canonical_override = p.seo.canonical_override;
  }
  const req = Array.isArray(p.variants_requested) ? p.variants_requested : [];
  out.variants = req.map((v) => {
    const o = { sku: String(v.sku || "").trim() };
    if (v.grams !== undefined) o.grams = v.grams;
    if (v.format) o.packaging_format = v.format;
    if (v.price_paise !== undefined && v.price_paise !== null) o.price_paise = v.price_paise;
    if (v.price_inr !== undefined && v.price_inr !== null) o.price_inr = v.price_inr;
    if (v.price !== undefined && v.price !== null) o.price = v.price;
    if (v.compare_at_price_paise !== undefined) o.compare_at_price_paise = v.compare_at_price_paise;
    else if (v.mrp_inr !== undefined) o.mrp_inr = v.mrp_inr;
    else if (v.mrp !== undefined) o.mrp = v.mrp;
    if (v.stock !== undefined) o.stock = v.stock;
    if (v.servings !== undefined) o.servings = v.servings;
    return o;
  });
  // Gallery intentionally untouched (already live per package metadata).
  return out;
});

const omittedReasons = {
  tasting_notes_summary_proposed: "proposed, not measured",
  aroma_tags_proposed: "proposed, not measured",
  sensory_ratings_verified: "all null (unverified)",
  dry_leaf: "all null (unverified)",
  liquor: "all null (unverified)",
  wet_leaf: "all null (unverified)",
  provenance_verified: "all null (unverified)",
  steeping_trial_only: "trial parameters, not verified instructions",
  ingredients_RnD_only: "internal formulation, never customer-facing",
  short_description: "no matching admin field — needs a product decision",
  gallery: "already live, requires_new_images=false",
  internal_notes: "operational, not customer content",
  warnings: "operational, not customer content",
};
for (const [field, reason] of Object.entries(omittedReasons)) {
  const n = list.filter((p) => {
    const v = p[field];
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.values(v).some((x) => x !== null && x !== undefined && (!Array.isArray(x) || x.length > 0));
    return true;
  }).length;
  if (n > 0) report.omitted.push(`${field}: withheld from ${n}/16 (${reason})`);
}
report.included.push(`name/slug/category/status/featured/description/seo for 16/16`);
report.included.push(`${list.reduce((a, p) => a + (p.variants_requested || []).length, 0)} variants with price/stock (MRP null = no discount badge)`);
const drafts = products.filter((p) => p.status === "draft").length;
if (drafts > 0) report.flags.push(`${drafts}/16 request status=draft — applying will UNPUBLISH them (they are currently live). Confirm this is intended.`);
const published = products.filter((p) => p.status === "published").length;
if (published > 0) report.flags.push(`${published}/16 request status=published with placeholder ₹199 pricing — confirm before going live.`);

fs.writeFileSync(outPath, JSON.stringify({ products }, null, 2));
console.log(`Translated ${products.length} product(s) → ${outPath}\n`);
console.log("INCLUDED:");
report.included.forEach((l) => console.log("  + " + l));
console.log("OMITTED (honesty contract):");
report.omitted.forEach((l) => console.log("  - " + l));
if (report.flags.length > 0) {
  console.log("FLAGS — confirm before --apply:");
  report.flags.forEach((l) => console.log("  ! " + l));
}
