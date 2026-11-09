// 042: Add chapter_label column to sliders and set clean button labels & links.
export function up(db) {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sliders'").get();
  if (table) {
    const cols = new Set(
      db.prepare("PRAGMA table_info(sliders)").all().map((c) => c.name)
    );

    if (!cols.has("chapter_label")) {
      db.exec("ALTER TABLE sliders ADD COLUMN chapter_label TEXT NOT NULL DEFAULT '';");
    }

    // Backfill slider 1: set clear chapter label and dedicated button text & link
    const s1 = db.prepare("SELECT id, cta_label FROM sliders WHERE id = 1").get();
    if (s1) {
      db.prepare(`
        UPDATE sliders SET
          chapter_label = '01. Darjeeling First Flush',
          cta_label = CASE WHEN cta_label = 'From Our Gardens to Your Cup' THEN 'Shop Darjeeling First Flush' ELSE cta_label END,
          cta_href = CASE WHEN cta_href = '/shop' OR cta_href = '' THEN '/collections/darjeeling' ELSE cta_href END,
          card_cta_label = CASE WHEN card_cta_label = '' THEN 'View Harvest' ELSE card_cta_label END,
          card_cta_href = CASE WHEN card_cta_href = '/shop' OR card_cta_href = '' THEN '/collections/darjeeling' ELSE card_cta_href END
        WHERE id = 1
      `).run();
    }

    // Backfill slider 2
    const s2 = db.prepare("SELECT id FROM sliders WHERE id = 2").get();
    if (s2) {
      db.prepare(`
        UPDATE sliders SET
          chapter_label = '02. High-Altitude Oolong',
          cta_label = CASE WHEN cta_label = 'Origin Cupping & Ceremony' THEN 'Explore High Terroirs' ELSE cta_label END
        WHERE id = 2
      `).run();
    }

    // Backfill slider 3
    const s3 = db.prepare("SELECT id FROM sliders WHERE id = 3").get();
    if (s3) {
      db.prepare(`
        UPDATE sliders SET
          chapter_label = '03. Himalayan Gold Black',
          cta_label = CASE WHEN cta_label = 'Crafted by Master Planters' THEN 'Discover Clonal Teas' ELSE cta_label END
        WHERE id = 3
      `).run();
    }
  }
}

export function down() {}
