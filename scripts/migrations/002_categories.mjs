export function up(db) {
  db.exec([
    "CREATE TABLE IF NOT EXISTS categories (",
    "id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "slug TEXT NOT NULL UNIQUE,",
    "name TEXT NOT NULL,",
    "sort_order INTEGER NOT NULL DEFAULT 0,",
    "is_active INTEGER NOT NULL DEFAULT 1,",
    "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
  ].join("\n"));
  const cols = db.prepare("PRAGMA table_info(products)").all().map((c) => c.name);
  if (!cols.includes("category_id")) {
    db.exec("ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id);");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);");
  // Backfill distinct legacy category values as slugs (guarded, idempotent).
  const distinct = db.prepare("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> ''").all();
  const insert = db.prepare("INSERT OR IGNORE INTO categories (slug, name) VALUES (?, ?)");
  const link = db.prepare("UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = ?) WHERE category = ? AND (category_id IS NULL)");
  const slugify = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "uncategorised";
  for (const row of distinct) {
    const slug = slugify(String(row.category));
    insert.run(slug, String(row.category).slice(0, 60));
    link.run(slug, row.category);
  }
}
// Down migration: no-op by policy (additive only, legacy products.category retained read-only).
export function down() {}
