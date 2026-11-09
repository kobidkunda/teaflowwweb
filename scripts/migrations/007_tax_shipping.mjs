// 007: tax + shipping-method columns on orders (additive, backfill-safe).
// tax_paise records the GST-inclusive breakout computed in src/lib/money.ts
// (informational only — checkout totals already include it). shipping_method
// names the demo schedule ("standard"); a carrier integration adds values,
// never rewrites this default.
export function up(db) {
  const cols = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
  if (!cols.includes("tax_paise")) {
    db.exec("ALTER TABLE orders ADD COLUMN tax_paise INTEGER NOT NULL DEFAULT 0 CHECK(tax_paise >= 0);");
  }
  if (!cols.includes("shipping_method")) {
    db.exec("ALTER TABLE orders ADD COLUMN shipping_method TEXT NOT NULL DEFAULT 'standard';");
  }
  db.exec("UPDATE orders SET tax_paise = 0 WHERE tax_paise IS NULL;");
  db.exec("UPDATE orders SET shipping_method = 'standard' WHERE shipping_method IS NULL OR shipping_method = '';");
}
export function down() {}
