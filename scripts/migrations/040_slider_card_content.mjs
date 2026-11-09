// 040: Add editable Featured Harvest Card content fields to sliders (additive, versioned).
export function up(db) {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sliders'").get();
  if (table) {
    const cols = new Set(
      db.prepare("PRAGMA table_info(sliders)").all().map((c) => c.name)
    );

    const newColumns = [
      ["card_tag", "TEXT NOT NULL DEFAULT ''"],
      ["card_title", "TEXT NOT NULL DEFAULT ''"],
      ["card_subtitle", "TEXT NOT NULL DEFAULT ''"],
      ["card_tasting_notes", "TEXT NOT NULL DEFAULT ''"],
      ["card_quote", "TEXT NOT NULL DEFAULT ''"],
      ["card_badge", "TEXT NOT NULL DEFAULT ''"],
      ["card_cta_label", "TEXT NOT NULL DEFAULT ''"],
      ["card_cta_href", "TEXT NOT NULL DEFAULT ''"],
    ];

    for (const [colName, colDef] of newColumns) {
      if (!cols.has(colName)) {
        db.exec(`ALTER TABLE sliders ADD COLUMN ${colName} ${colDef};`);
      }
    }

    // Backfill defaults for baseline seeded sliders
    const s1 = db.prepare("SELECT id, card_title FROM sliders WHERE id = 1").get();
    if (s1 && (!s1.card_title || s1.card_title === "")) {
      db.prepare(`
        UPDATE sliders SET
          card_tag = ?,
          card_title = ?,
          card_subtitle = ?,
          card_tasting_notes = ?,
          card_quote = ?,
          card_badge = ?,
          card_cta_label = ?,
          card_cta_href = ?
        WHERE id = 1
      `).run(
        "2026 First Flush · Margaret's Hope",
        "Darjeeling First Flush",
        "Single Estate · 6,800 ft",
        "Muscatel • Wild Orchid • Crisp Finish",
        "From Our Gardens to Your Cup",
        "ESTATE HARVEST",
        "View Harvest",
        "/shop"
      );
    }

    const s2 = db.prepare("SELECT id, card_title FROM sliders WHERE id = 2").get();
    if (s2 && (!s2.card_title || s2.card_title === "")) {
      db.prepare(`
        UPDATE sliders SET
          card_tag = ?,
          card_title = ?,
          card_subtitle = ?,
          card_tasting_notes = ?,
          card_quote = ?,
          card_badge = ?,
          card_cta_label = ?,
          card_cta_href = ?
        WHERE id = 2
      `).run(
        "Reserve Lot 04 · Giddapahar Estate",
        "High-Altitude Oolong",
        "7,200 ft Elevation",
        "Roasted Walnut • Peach Blossom • Honeyed",
        "Origin Cupping & Ceremony",
        "ESTATE HARVEST",
        "View Harvest",
        "/shop?category=Black%20Tea"
      );
    }

    const s3 = db.prepare("SELECT id, card_title FROM sliders WHERE id = 3").get();
    if (s3 && (!s3.card_title || s3.card_title === "")) {
      db.prepare(`
        UPDATE sliders SET
          card_tag = ?,
          card_title = ?,
          card_subtitle = ?,
          card_tasting_notes = ?,
          card_quote = ?,
          card_badge = ?,
          card_cta_label = ?,
          card_cta_href = ?
        WHERE id = 3
      `).run(
        "Heritage Clonal · Upper Assam",
        "Himalayan Gold Black",
        "Heritage Garden Orthodox",
        "Malty Cocoa • Sweet Raisin • Deep Amber",
        "Crafted by Master Planters",
        "ESTATE HARVEST",
        "View Harvest",
        "/shop?category=Green%20Tea"
      );
    }
  }
}

export function down() {}
