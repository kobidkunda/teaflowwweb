// 055: Support trial packs in cart_items and partial shipping address capture in abandoned_carts.
// Additive, versioned, and idempotent.

export function up(db) {
  const abandonedCartCols = db
    .prepare("PRAGMA table_info(abandoned_carts)")
    .all()
    .map((c) => c.name);

  if (abandonedCartCols.length > 0) {
    if (!abandonedCartCols.includes("shipping_city")) {
      db.exec("ALTER TABLE abandoned_carts ADD COLUMN shipping_city TEXT DEFAULT NULL;");
    }
    if (!abandonedCartCols.includes("shipping_state")) {
      db.exec("ALTER TABLE abandoned_carts ADD COLUMN shipping_state TEXT DEFAULT NULL;");
    }
    if (!abandonedCartCols.includes("shipping_postcode")) {
      db.exec("ALTER TABLE abandoned_carts ADD COLUMN shipping_postcode TEXT DEFAULT NULL;");
    }
    if (!abandonedCartCols.includes("shipping_address")) {
      db.exec("ALTER TABLE abandoned_carts ADD COLUMN shipping_address TEXT DEFAULT NULL;");
    }
  }

  const cartItemsCols = db
    .prepare("PRAGMA table_info(cart_items)")
    .all()
    .map((c) => c.name);

  if (cartItemsCols.length > 0 && !cartItemsCols.includes("trial_id")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cart_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cart_id TEXT NOT NULL REFERENCES abandoned_carts(id) ON DELETE CASCADE,
        variant_id INTEGER DEFAULT NULL REFERENCES variants(id),
        trial_id TEXT DEFAULT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0 AND quantity <= 10000),
        unit_price_paise INTEGER NOT NULL CHECK(unit_price_paise >= 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO cart_items_new (id, cart_id, variant_id, trial_id, quantity, unit_price_paise, created_at)
        SELECT id, cart_id, variant_id, NULL, quantity, unit_price_paise, created_at FROM cart_items;
      DROP TABLE cart_items;
      ALTER TABLE cart_items_new RENAME TO cart_items;
      CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
      CREATE INDEX IF NOT EXISTS idx_cart_items_variant ON cart_items(variant_id);
      CREATE INDEX IF NOT EXISTS idx_cart_items_trial ON cart_items(trial_id);
    `);
  }
}

export function down() {
  // Additive migration; no destructive down step.
}
