export function up(db) {
  db.exec([
    "CREATE TABLE IF NOT EXISTS product_images (",
    "id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,",
    "url TEXT NOT NULL,",
    "alt_text TEXT NOT NULL DEFAULT '',",
    "sort_order INTEGER NOT NULL DEFAULT 0,",
    "is_primary INTEGER NOT NULL DEFAULT 0,",
    "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
    "CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);",
  ].join("\n"));
}
export function down() {}
