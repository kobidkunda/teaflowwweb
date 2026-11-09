// 043: Add page_target and category_slug columns to sliders to support /shop dynamic sliders.
export function up(db) {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sliders'").get();
  if (table) {
    const cols = new Set(
      db.prepare("PRAGMA table_info(sliders)").all().map((c) => c.name)
    );

    if (!cols.has("page_target")) {
      db.exec("ALTER TABLE sliders ADD COLUMN page_target TEXT NOT NULL DEFAULT 'home';");
    }

    if (!cols.has("category_slug")) {
      db.exec("ALTER TABLE sliders ADD COLUMN category_slug TEXT NOT NULL DEFAULT '';");
    }

    // Seed a baseline high-elevation collection slider for /shop if no shop slider exists yet
    const existingShopSlider = db.prepare("SELECT id FROM sliders WHERE page_target = 'shop'").get();
    if (!existingShopSlider) {
      db.prepare(`
        INSERT INTO sliders (
          title, subtitle, image_url, fg_image_url, cta_label, cta_href,
          sort_order, is_active, starts_at, ends_at,
          card_tag, card_title, card_subtitle, card_tasting_notes, card_quote, card_badge, card_cta_label, card_cta_href,
          card_enabled, chapter_label, page_target, category_slug
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(
        "Fine Tea Collection — Single-Estate Flushes",
        "Explore pure, single-estate flushes from Darjeeling, Assam, Kangra, and Nilgiri. Graded, cupped, and packaged at origin to preserve high-mountain aromatics.",
        "/uploads/hero-himalayan-tea.webp",
        "/uploads/darjeeling-spring-hero-v2.webp",
        "Explore Single Estates",
        "/shop",
        1,
        1,
        null,
        null,
        "2026 Fresh Origin Batches",
        "Single-Estate Harvests",
        "Himalayan High Terroirs",
        "Authentic Orthodoxy • High Mountain",
        "From Our Gardens to Your Cup",
        "CURATED COLLECTION",
        "Browse Collection",
        "/shop",
        1,
        "01. Fine Tea Collection",
        "shop",
        ""
      );
    }
  }
}

export function down() {}
