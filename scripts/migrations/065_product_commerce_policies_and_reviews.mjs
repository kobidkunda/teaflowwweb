// 065: Product-level & store-wide commerce policy overrides (delivery timeframe, shipping fee, returns)
// and verified-buyer product reviews table for Google / OpenAI / AI search structured data.

const POLICY_OVERRIDE_COLUMNS = [
  ["shipping_fee_paise_override", "INTEGER DEFAULT NULL"],
  ["handling_days_min_override", "INTEGER DEFAULT NULL"],
  ["handling_days_max_override", "INTEGER DEFAULT NULL"],
  ["transit_days_min_override", "INTEGER DEFAULT NULL"],
  ["transit_days_max_override", "INTEGER DEFAULT NULL"],
  ["return_window_days_override", "INTEGER DEFAULT NULL"],
  ["return_fees_override", "TEXT DEFAULT NULL"],
];

function ensureColumns(db, tableName) {
  const tableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(tableName);
  if (!tableExists) return;

  const existing = new Set(
    db.prepare(`PRAGMA table_info(${tableName})`).all().map((c) => c.name)
  );
  for (const [colName, colDef] of POLICY_OVERRIDE_COLUMNS) {
    if (!existing.has(colName)) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef}`);
    }
  }
}

export function up(db) {
  const hasStoreSettings = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='store_settings'")
    .get();
  if (hasStoreSettings) {
    const defaults = [
      ["handling_days_min", "1"],
      ["handling_days_max", "2"],
      ["transit_days_min", "2"],
      ["transit_days_max", "5"],
      ["return_fees", "FreeReturn"],
      ["return_method", "ReturnByMail"],
      ["return_policy_label", ""],
    ];
    const stmt = db.prepare(
      "INSERT INTO store_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO NOTHING"
    );
    for (const [k, v] of defaults) {
      stmt.run(k, v);
    }
  }

  ensureColumns(db, "products");
  ensureColumns(db, "trials");
  ensureColumns(db, "pl_packaging_variants");

  db.exec(`
    CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('product', 'trial', 'packaging')),
      entity_id TEXT NOT NULL,
      order_id TEXT DEFAULT NULL,
      commerce_order_id TEXT DEFAULT NULL,
      customer_id INTEGER DEFAULT NULL,
      reviewer_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      verified_purchase INTEGER NOT NULL DEFAULT 0 CHECK(verified_purchase IN (0, 1)),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_product_reviews_entity_status
      ON product_reviews(entity_type, entity_id, status);
    CREATE INDEX IF NOT EXISTS idx_product_reviews_status_created
      ON product_reviews(status, created_at DESC);
  `);
}

export function down() {
  // Additive-only policy
}
