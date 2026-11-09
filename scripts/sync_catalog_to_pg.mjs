import Database from "better-sqlite3";
import pg from "pg";
const { Client } = pg;

async function sync() {
  const sqlite = new Database("./data/store.sqlite");
  const pgClient = new Client({
    host: process.env.PGHOST || "localhost",
    port: parseInt(process.env.PGPORT || "5433", 10),
    user: process.env.PGUSER || "teafloww",
    password: process.env.PGPASSWORD || "teafloww",
    database: process.env.PGDATABASE || "teafloww",
  });

  await pgClient.connect();
  console.log("Connected to PostgreSQL");

  try {
    await pgClient.query("BEGIN");

    // 1. Sync categories
    const categories = sqlite.prepare("SELECT * FROM categories ORDER BY id ASC").all();
    console.log(`Syncing ${categories.length} categories...`);
    for (const c of categories) {
      await pgClient.query(
        `INSERT INTO categories (id, slug, name, sort_order, is_active, created_at, description, cover_image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           slug = EXCLUDED.slug,
           name = EXCLUDED.name,
           sort_order = EXCLUDED.sort_order,
           is_active = EXCLUDED.is_active,
           description = EXCLUDED.description,
           cover_image_url = EXCLUDED.cover_image_url`,
        [
          c.id,
          c.slug,
          c.name,
          c.sort_order || 0,
          c.is_active ?? 1,
          c.created_at || new Date().toISOString(),
          c.description || "",
          c.cover_image_url || null,
        ]
      );
    }
    await pgClient.query("SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM categories))");

    // 2. Sync products
    const products = sqlite.prepare("SELECT * FROM products ORDER BY id ASC").all();
    console.log(`Syncing ${products.length} products...`);
    for (const p of products) {
      await pgClient.query(
        `INSERT INTO products (
          id, slug, name, category, origin, estate, flush, harvest_date, description, tasting_notes,
          floral, fruity, malty, body, brew_temp, brew_seconds, featured, category_id,
          dry_leaf_appearance, dry_leaf_grade, dry_leaf_aroma, liquor_hue_hex, liquor_hue_name,
          liquor_clarity, liquor_body, wet_leaf_aroma, wet_leaf_oxidation, sweetness, earthy,
          aroma_tags, leaf_dose_grams, water_ml, steep_count, steep_instructions,
          elevation_feet, elevation_display, lot_number, cultivar, estate_story,
          seo_title, seo_description, canonical_override, noindex, ingredients, verified_origin, status,
          pdf_url, pdf_title
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23,
          $24, $25, $26, $27, $28, $29,
          $30, $31, $32, $33, $34,
          $35, $36, $37, $38, $39,
          $40, $41, $42, $43, $44, $45, $46,
          $47, $48
        )
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          origin = EXCLUDED.origin,
          estate = EXCLUDED.estate,
          flush = EXCLUDED.flush,
          harvest_date = EXCLUDED.harvest_date,
          description = EXCLUDED.description,
          tasting_notes = EXCLUDED.tasting_notes,
          floral = EXCLUDED.floral,
          fruity = EXCLUDED.fruity,
          malty = EXCLUDED.malty,
          body = EXCLUDED.body,
          brew_temp = EXCLUDED.brew_temp,
          brew_seconds = EXCLUDED.brew_seconds,
          featured = EXCLUDED.featured,
          category_id = EXCLUDED.category_id,
          dry_leaf_appearance = EXCLUDED.dry_leaf_appearance,
          dry_leaf_grade = EXCLUDED.dry_leaf_grade,
          dry_leaf_aroma = EXCLUDED.dry_leaf_aroma,
          liquor_hue_hex = EXCLUDED.liquor_hue_hex,
          liquor_hue_name = EXCLUDED.liquor_hue_name,
          liquor_clarity = EXCLUDED.liquor_clarity,
          liquor_body = EXCLUDED.liquor_body,
          wet_leaf_aroma = EXCLUDED.wet_leaf_aroma,
          wet_leaf_oxidation = EXCLUDED.wet_leaf_oxidation,
          sweetness = EXCLUDED.sweetness,
          earthy = EXCLUDED.earthy,
          aroma_tags = EXCLUDED.aroma_tags,
          leaf_dose_grams = EXCLUDED.leaf_dose_grams,
          water_ml = EXCLUDED.water_ml,
          steep_count = EXCLUDED.steep_count,
          steep_instructions = EXCLUDED.steep_instructions,
          elevation_feet = EXCLUDED.elevation_feet,
          elevation_display = EXCLUDED.elevation_display,
          lot_number = EXCLUDED.lot_number,
          cultivar = EXCLUDED.cultivar,
          estate_story = EXCLUDED.estate_story,
          seo_title = EXCLUDED.seo_title,
          seo_description = EXCLUDED.seo_description,
          canonical_override = EXCLUDED.canonical_override,
          noindex = EXCLUDED.noindex,
          ingredients = EXCLUDED.ingredients,
          verified_origin = EXCLUDED.verified_origin,
          status = 'published',
          pdf_url = EXCLUDED.pdf_url,
          pdf_title = EXCLUDED.pdf_title`,
        [
          p.id,
          p.slug,
          p.name,
          p.category,
          p.origin,
          p.estate,
          p.flush,
          p.harvest_date,
          p.description,
          p.tasting_notes,
          p.floral || 0,
          p.fruity || 0,
          p.malty || 0,
          p.body || 0,
          p.brew_temp || 90,
          p.brew_seconds || 180,
          p.featured || 0,
          p.category_id || null,
          p.dry_leaf_appearance || "",
          p.dry_leaf_grade || "",
          p.dry_leaf_aroma || "",
          p.liquor_hue_hex || "#b36b3d",
          p.liquor_hue_name || "",
          p.liquor_clarity || "",
          p.liquor_body || "",
          p.wet_leaf_aroma || "",
          p.wet_leaf_oxidation || "",
          p.sweetness || 0,
          p.earthy || 0,
          p.aroma_tags || "[]",
          p.leaf_dose_grams || 2.5,
          p.water_ml || 200,
          p.steep_count || 3,
          p.steep_instructions || "",
          p.elevation_feet || 0,
          p.elevation_display || "",
          p.lot_number || "",
          p.cultivar || "",
          p.estate_story || "",
          p.seo_title || null,
          p.seo_description || null,
          p.canonical_override || null,
          p.noindex || 0,
          p.ingredients || "",
          p.verified_origin || p.origin || "",
          "published",
          p.pdf_url || null,
          p.pdf_title || null,
        ]
      );
    }
    await pgClient.query("SELECT setval('products_id_seq', (SELECT COALESCE(MAX(id), 1) FROM products))");

    // 3. Sync variants
    const variants = sqlite.prepare("SELECT * FROM variants ORDER BY id ASC").all();
    console.log(`Syncing ${variants.length} variants...`);
    for (const v of variants) {
      await pgClient.query(
        `INSERT INTO variants (id, product_id, sku, grams, price_paise, stock, packaging_format, servings)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           product_id = EXCLUDED.product_id,
           sku = EXCLUDED.sku,
           grams = EXCLUDED.grams,
           price_paise = EXCLUDED.price_paise,
           stock = EXCLUDED.stock,
           packaging_format = EXCLUDED.packaging_format,
           servings = EXCLUDED.servings`,
        [
          v.id,
          v.product_id,
          v.sku,
          v.grams,
          v.price_paise,
          v.stock || 0,
          v.packaging_format || "loose_leaf_pouch",
          v.servings || 50,
        ]
      );
    }
    await pgClient.query("SELECT setval('variants_id_seq', (SELECT COALESCE(MAX(id), 1) FROM variants))");

    // 4. Sync product_images
    const images = sqlite.prepare("SELECT * FROM product_images ORDER BY id ASC").all();
    console.log(`Syncing ${images.length} product images...`);
    for (const img of images) {
      await pgClient.query(
        `INSERT INTO product_images (id, product_id, url, alt_text, sort_order, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           product_id = EXCLUDED.product_id,
           url = EXCLUDED.url,
           alt_text = EXCLUDED.alt_text,
           sort_order = EXCLUDED.sort_order,
           is_primary = EXCLUDED.is_primary`,
        [
          img.id,
          img.product_id,
          img.url,
          img.alt_text || "",
          img.sort_order || 0,
          img.is_primary || 0,
        ]
      );
    }
    await pgClient.query("SELECT setval('product_images_id_seq', (SELECT COALESCE(MAX(id), 1) FROM product_images))");

    // 5. Sync site_pages
    const pages = sqlite.prepare("SELECT * FROM site_pages ORDER BY id ASC").all();
    console.log(`Syncing ${pages.length} site pages...`);
    for (const page of pages) {
      await pgClient.query(
        `INSERT INTO site_pages (id, slug, title, eyebrow, headline, subtitle, hero_image_url, hero_media_id, body_markdown, sections_json, meta_title, meta_description, is_published, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title,
           eyebrow = EXCLUDED.eyebrow,
           headline = EXCLUDED.headline,
           subtitle = EXCLUDED.subtitle,
           hero_image_url = EXCLUDED.hero_image_url,
           hero_media_id = EXCLUDED.hero_media_id,
           body_markdown = EXCLUDED.body_markdown,
           sections_json = EXCLUDED.sections_json,
           meta_title = EXCLUDED.meta_title,
           meta_description = EXCLUDED.meta_description,
           is_published = EXCLUDED.is_published,
           updated_at = EXCLUDED.updated_at`,
        [
          page.id,
          page.slug,
          page.title,
          page.eyebrow || "",
          page.headline || "",
          page.subtitle || "",
          page.hero_image_url || "",
          page.hero_media_id || null,
          page.body_markdown || "",
          page.sections_json || "[]",
          page.meta_title || "",
          page.meta_description || "",
          page.is_published ?? 1,
          page.created_at || new Date().toISOString(),
          page.updated_at || new Date().toISOString(),
        ]
      );
    }
    await pgClient.query("SELECT setval('site_pages_id_seq', (SELECT COALESCE(MAX(id), 1) FROM site_pages))");

    await pgClient.query("COMMIT");
    console.log("Successfully committed all catalog data to PostgreSQL!");

    // Run zero-mockup purge check
    console.log("Running zero-mockup guard on PostgreSQL...");
    const { runMockupPurge } = await import("./purge-mockup-data.mjs");
    process.env.DATABASE_TYPE = "postgres";
    await runMockupPurge();
  } catch (err) {
    await pgClient.query("ROLLBACK");
    console.error("Migration error:", err);
    process.exit(1);
  } finally {
    sqlite.close();
    await pgClient.end();
  }
}

sync();
