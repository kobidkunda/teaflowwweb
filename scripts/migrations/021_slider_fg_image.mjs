// 021: Add foreground card image support to homepage hero sliders (additive, versioned).
export function up(db) {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sliders'").get();
  if (table) {
    const cols = new Set(
      db.prepare("PRAGMA table_info(sliders)").all().map((c) => c.name)
    );
    if (!cols.has("fg_image_url")) {
      db.exec("ALTER TABLE sliders ADD COLUMN fg_image_url TEXT NOT NULL DEFAULT '';");
    }
    if (!cols.has("fg_media_id")) {
      db.exec("ALTER TABLE sliders ADD COLUMN fg_media_id INTEGER REFERENCES media_uploads(id);");
    }

    // Backfill baseline foreground card images for default seeded sliders
    const s1 = db.prepare("SELECT id, fg_image_url FROM sliders WHERE id = 1").get();
    if (s1 && (!s1.fg_image_url || s1.fg_image_url === "" || s1.fg_image_url.includes("mockup"))) {
      db.prepare("UPDATE sliders SET fg_image_url = ? WHERE id = 1").run("/uploads/darjeeling-spring-hero-v2.webp");
    }
    const s2 = db.prepare("SELECT id, fg_image_url FROM sliders WHERE id = 2").get();
    if (s2 && (!s2.fg_image_url || s2.fg_image_url === "" || s2.fg_image_url.includes("mockup"))) {
      db.prepare("UPDATE sliders SET fg_image_url = ? WHERE id = 2").run("");
    }
    const s3 = db.prepare("SELECT id, fg_image_url FROM sliders WHERE id = 3").get();
    if (s3 && (!s3.fg_image_url || s3.fg_image_url === "" || s3.fg_image_url.includes("mockup"))) {
      db.prepare("UPDATE sliders SET fg_image_url = ? WHERE id = 3").run("");
    }
  }
}
export function down() {}
