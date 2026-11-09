// 041: Add card_enabled column to sliders to toggle the Featured Harvest Card on/off.
export function up(db) {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sliders'").get();
  if (table) {
    const cols = new Set(
      db.prepare("PRAGMA table_info(sliders)").all().map((c) => c.name)
    );

    if (!cols.has("card_enabled")) {
      db.exec("ALTER TABLE sliders ADD COLUMN card_enabled INTEGER NOT NULL DEFAULT 1;");
    }

    // Disable front card on slider 2 to show full-width editorial layout
    const s2 = db.prepare("SELECT id, fg_image_url FROM sliders WHERE id = 2").get();
    if (s2) {
      db.prepare("UPDATE sliders SET card_enabled = 0 WHERE id = 2").run();
    }
  }
}

export function down() {}
