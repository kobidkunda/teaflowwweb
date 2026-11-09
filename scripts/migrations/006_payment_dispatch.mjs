export function up(db) {
  const cols = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
  // SQLite cannot ADD COLUMN with a non-constant CHECK referencing new values cleanly on
  // every version, so add plain columns then rely on service-layer enforcement; CHECKs
  // below apply to fresh tables via CREATE, and to existing tables where supported.
  if (!cols.includes("payment_status")) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid';");
  }
  if (!cols.includes("dispatch_status")) {
    db.exec("ALTER TABLE orders ADD COLUMN dispatch_status TEXT NOT NULL DEFAULT 'unfulfilled';");
  }
  db.exec("UPDATE orders SET payment_status='unpaid' WHERE status='demo_unpaid' AND (payment_status IS NULL OR payment_status='');");
  db.exec("UPDATE orders SET payment_status='unpaid' WHERE payment_status IS NULL OR payment_status='';");
  db.exec("UPDATE orders SET dispatch_status='unfulfilled' WHERE dispatch_status IS NULL OR dispatch_status='';");
  db.exec([
    "CREATE TABLE IF NOT EXISTS order_payments (",
    "id TEXT PRIMARY KEY,",
    "order_id TEXT NOT NULL REFERENCES orders(id),",
    "gateway TEXT NOT NULL DEFAULT 'demo',",
    "gateway_payment_id TEXT UNIQUE,",
    "amount_paise INTEGER NOT NULL CHECK(amount_paise >= 0),",
    "status TEXT NOT NULL DEFAULT 'payment_pending'",
    " CHECK(status IN ('payment_pending','paid','payment_failed','refunded')),",
    "idempotency_key TEXT NOT NULL UNIQUE,",
    "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
    "CREATE TABLE IF NOT EXISTS payment_events (",
    "id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "order_id TEXT NOT NULL REFERENCES orders(id),",
    "from_status TEXT NOT NULL,",
    "to_status TEXT NOT NULL,",
    "actor TEXT NOT NULL DEFAULT 'system',",
    "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
    "CREATE TABLE IF NOT EXISTS admin_idempotency (",
    "key TEXT PRIMARY KEY,",
    "resource TEXT NOT NULL,",
    "response TEXT NOT NULL,",
    "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
  ].join("\n"));
}
export function down() {}
