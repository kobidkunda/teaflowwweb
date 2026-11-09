export function up(db) {
  db.exec([
    "CREATE TABLE IF NOT EXISTS coupons (",
    "code TEXT PRIMARY KEY,",
    "kind TEXT NOT NULL CHECK(kind IN ('percent','flat')),",
    "value INTEGER NOT NULL CHECK(value > 0),",
    "min_subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK(min_subtotal_paise >= 0),",
    "max_uses INTEGER,",
    "used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count >= 0),",
    "starts_at TEXT,",
    "ends_at TEXT,",
    "is_active INTEGER NOT NULL DEFAULT 1,",
    "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
  ].join("\n"));
  const cols = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
  if (!cols.includes("coupon_code")) {
    db.exec("ALTER TABLE orders ADD COLUMN coupon_code TEXT REFERENCES coupons(code);");
  }
  if (!cols.includes("discount_paise")) {
    db.exec("ALTER TABLE orders ADD COLUMN discount_paise INTEGER NOT NULL DEFAULT 0 CHECK(discount_paise >= 0);");
  }
}
export function down() {}
