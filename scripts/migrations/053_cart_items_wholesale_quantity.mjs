// 053: Update cart_items table CHECK constraint to allow wholesale quantities up to 10000
export function up(db) {
  const cartItemsTable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cart_items'").get();
  if (cartItemsTable && cartItemsTable.sql.includes("quantity <= 20")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cart_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cart_id TEXT NOT NULL REFERENCES abandoned_carts(id) ON DELETE CASCADE,
        variant_id INTEGER NOT NULL REFERENCES variants(id),
        quantity INTEGER NOT NULL CHECK(quantity > 0 AND quantity <= 10000),
        unit_price_paise INTEGER NOT NULL CHECK(unit_price_paise >= 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO cart_items_new (id, cart_id, variant_id, quantity, unit_price_paise, created_at)
        SELECT id, cart_id, variant_id, quantity, unit_price_paise, created_at FROM cart_items;
      DROP TABLE cart_items;
      ALTER TABLE cart_items_new RENAME TO cart_items;
      CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
      CREATE INDEX IF NOT EXISTS idx_cart_items_variant ON cart_items(variant_id);
    `);
  }
}

export function down(db) {
  // Revert only if needed
}
