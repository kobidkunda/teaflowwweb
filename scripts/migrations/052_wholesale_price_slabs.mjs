// 052: Wholesale mode tiered quantity price slabs and MOQ settings
export function up(db) {
  // 1. Add wholesale_moq column to products table if not exists
  const productTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
  if (productTable) {
    const cols = new Set(
      db.prepare("PRAGMA table_info(products)").all().map((c) => c.name)
    );
    if (!cols.has("wholesale_moq")) {
      db.exec("ALTER TABLE products ADD COLUMN wholesale_moq INTEGER DEFAULT NULL;");
    }
  }

  // 2. Create wholesale_slabs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wholesale_slabs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      variant_id INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
      min_qty INTEGER NOT NULL CHECK(min_qty > 0),
      price_paise INTEGER NOT NULL CHECK(price_paise >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(variant_id, min_qty)
    );
    CREATE INDEX IF NOT EXISTS idx_wholesale_slabs_variant ON wholesale_slabs(variant_id);
    CREATE INDEX IF NOT EXISTS idx_wholesale_slabs_product ON wholesale_slabs(product_id);
  `);

  // 3. Initialize default wholesale MOQ in store_settings if missing
  const settingsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='store_settings'").get();
  if (settingsTable) {
    db.prepare(`
      INSERT OR IGNORE INTO store_settings (key, value, updated_at)
      VALUES ('wholesale_moq', '50', CURRENT_TIMESTAMP)
    `).run();
  }
}

export function down(db) {
  try {
    db.exec("DROP TABLE IF EXISTS wholesale_slabs;");
  } catch {}
}
