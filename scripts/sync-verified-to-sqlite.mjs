import Database from "better-sqlite3";
import fs from "node:fs";

const db = new Database("./data/store.sqlite");

// 1. Insert categories 75-78 if missing
const categories = [
  { id: 75, name: "Bengal Signature Blends", slug: "bengal-signature-blends", sort_order: 10 },
  { id: 76, name: "Everyday Milk Chai", slug: "everyday-milk-chai", sort_order: 20 },
  { id: 77, name: "Regional Tea Origins", slug: "regional-tea-origins", sort_order: 30 },
  { id: 78, name: "Iced & Clear Teas", slug: "iced-clear-teas", sort_order: 40 },
];

const insertCat = db.prepare(`
  INSERT INTO categories (id, name, slug, sort_order, is_active)
  VALUES (@id, @name, @slug, @sort_order, 1)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    slug = excluded.slug,
    sort_order = excluded.sort_order,
    is_active = 1
`);

for (const cat of categories) {
  insertCat.run(cat);
}

// 2. Insert products 43-58
const products = JSON.parse(fs.readFileSync("./data/teafloww-16-products-verified.json", "utf-8"));

const insertProd = db.prepare(`
  INSERT INTO products (
    id, slug, name, category, origin, estate, flush, harvest_date, description, tasting_notes,
    floral, fruity, malty, body, brew_temp, brew_seconds, featured, category_id,
    dry_leaf_appearance, dry_leaf_grade, dry_leaf_aroma, liquor_hue_hex, liquor_hue_name,
    liquor_clarity, liquor_body, wet_leaf_aroma, wet_leaf_oxidation, sweetness, earthy,
    aroma_tags, leaf_dose_grams, water_ml, steep_count, steep_instructions,
    elevation_feet, elevation_display, lot_number, cultivar, estate_story,
    seo_title, seo_description, canonical_override, noindex, ingredients, verified_origin, status, is_enabled
  ) VALUES (
    @id, @slug, @name, @category, @origin, @estate, @flush, @harvest_date, @description, @tasting_notes,
    @floral, @fruity, @malty, @body, @brew_temp, @brew_seconds, @featured, @category_id,
    @dry_leaf_appearance, @dry_leaf_grade, @dry_leaf_aroma, @liquor_hue_hex, @liquor_hue_name,
    @liquor_clarity, @liquor_body, @wet_leaf_aroma, @wet_leaf_oxidation, @sweetness, @earthy,
    @aroma_tags, @leaf_dose_grams, @water_ml, @steep_count, @steep_instructions,
    @elevation_feet, @elevation_display, @lot_number, @cultivar, @estate_story,
    @seo_title, @seo_description, @canonical_override, @noindex, @ingredients, @verified_origin, @status, 1
  )
  ON CONFLICT(id) DO UPDATE SET
    slug = excluded.slug,
    name = excluded.name,
    category = excluded.category,
    origin = excluded.origin,
    estate = excluded.estate,
    flush = excluded.flush,
    harvest_date = excluded.harvest_date,
    description = excluded.description,
    tasting_notes = excluded.tasting_notes,
    floral = excluded.floral,
    fruity = excluded.fruity,
    malty = excluded.malty,
    body = excluded.body,
    brew_temp = excluded.brew_temp,
    brew_seconds = excluded.brew_seconds,
    featured = excluded.featured,
    category_id = excluded.category_id,
    dry_leaf_appearance = excluded.dry_leaf_appearance,
    dry_leaf_grade = excluded.dry_leaf_grade,
    dry_leaf_aroma = excluded.dry_leaf_aroma,
    liquor_hue_hex = excluded.liquor_hue_hex,
    liquor_hue_name = excluded.liquor_hue_name,
    liquor_clarity = excluded.liquor_clarity,
    liquor_body = excluded.liquor_body,
    wet_leaf_aroma = excluded.wet_leaf_aroma,
    wet_leaf_oxidation = excluded.wet_leaf_oxidation,
    sweetness = excluded.sweetness,
    earthy = excluded.earthy,
    aroma_tags = excluded.aroma_tags,
    leaf_dose_grams = excluded.leaf_dose_grams,
    water_ml = excluded.water_ml,
    steep_count = excluded.steep_count,
    steep_instructions = excluded.steep_instructions,
    elevation_feet = excluded.elevation_feet,
    elevation_display = excluded.elevation_display,
    lot_number = excluded.lot_number,
    cultivar = excluded.cultivar,
    estate_story = excluded.estate_story,
    seo_title = excluded.seo_title,
    seo_description = excluded.seo_description,
    canonical_override = excluded.canonical_override,
    noindex = excluded.noindex,
    ingredients = excluded.ingredients,
    verified_origin = excluded.verified_origin,
    status = excluded.status,
    is_enabled = 1
`);

const insertVariant = db.prepare(`
  INSERT INTO variants (
    product_id, sku, grams, price_paise, stock, packaging_format, servings
  ) VALUES (
    @product_id, @sku, @grams, 19900, 50, 'loose_leaf_pouch', @servings
  )
  ON CONFLICT(sku) DO UPDATE SET
    price_paise = 19900,
    stock = 50
`);

const PACK_SIZES = [
  { suffix: "100G", grams: 100, servings: 50 },
  { suffix: "250G", grams: 250, servings: 125 },
  { suffix: "500G", grams: 500, servings: 250 },
  { suffix: "1KG", grams: 1000, servings: 500 },
];

for (let i = 0; i < products.length; i++) {
  const p = products[i];
  const itemNum = String(i + 1).padStart(3, "0");
  const row = {
    ...p,
    featured: 0,
    canonical_override: null,
    noindex: 0,
    aroma_tags: JSON.stringify(p.aroma_tags),
  };
  insertProd.run(row);

  for (const size of PACK_SIZES) {
    const sku = `TFW-${itemNum}-${size.suffix}`;
    insertVariant.run({
      product_id: p.id,
      sku,
      grams: size.grams,
      servings: size.servings,
    });
  }
}

console.log("Successfully synced all 16 products, categories, and 64 variants into local SQLite.");
