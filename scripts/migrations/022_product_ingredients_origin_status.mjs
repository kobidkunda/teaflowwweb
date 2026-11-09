// 022: Add ingredients, verified_origin, and publication status to products table (additive, versioned).
export function up(db) {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
  if (table) {
    const cols = new Set(
      db.prepare("PRAGMA table_info(products)").all().map((c) => c.name)
    );
    if (!cols.has("ingredients")) {
      db.exec("ALTER TABLE products ADD COLUMN ingredients TEXT NOT NULL DEFAULT '';");
    }
    if (!cols.has("verified_origin")) {
      db.exec("ALTER TABLE products ADD COLUMN verified_origin TEXT NOT NULL DEFAULT '';");
    }
    if (!cols.has("status")) {
      db.exec("ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'published';");
    }

    db.exec("CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);");
  }
}

export function down() {}
