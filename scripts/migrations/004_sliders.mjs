export function up(db) {
  db.exec([
    "CREATE TABLE IF NOT EXISTS sliders (",
    "id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "title TEXT NOT NULL,",
    "subtitle TEXT NOT NULL DEFAULT '',",
    "image_url TEXT NOT NULL,",
    "cta_label TEXT NOT NULL DEFAULT '',",
    "cta_href TEXT NOT NULL DEFAULT '',",
    "sort_order INTEGER NOT NULL DEFAULT 0,",
    "is_active INTEGER NOT NULL DEFAULT 1,",
    "starts_at TEXT,",
    "ends_at TEXT,",
    "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
    "CREATE INDEX IF NOT EXISTS idx_sliders_active_order ON sliders(is_active, sort_order);",
  ].join("\n"));
}
export function down() {}
