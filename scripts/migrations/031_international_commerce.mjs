/** Additive, portable SQL: no existing order or price fields are rewritten. */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS commerce_markets (code TEXT PRIMARY KEY, document TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS commerce_config (key TEXT PRIMARY KEY, document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS commerce_fx (id TEXT PRIMARY KEY, document TEXT NOT NULL, updated_ms BIGINT NOT NULL, next_ms BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS commerce_quotes (id TEXT PRIMARY KEY, owner TEXT NOT NULL, document TEXT NOT NULL, expires_ms BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS commerce_orders (id TEXT PRIMARY KEY, owner TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, quote_id TEXT NOT NULL UNIQUE REFERENCES commerce_quotes(id), document TEXT NOT NULL, payment_status TEXT NOT NULL, fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled', gateway_order_id TEXT UNIQUE, gateway_payment_id TEXT UNIQUE, reserved_until BIGINT NOT NULL, inventory_status TEXT NOT NULL DEFAULT 'reserved', refund_minor BIGINT NOT NULL DEFAULT 0, created_ms BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS commerce_reservations (order_id TEXT NOT NULL REFERENCES commerce_orders(id), variant_id INTEGER NOT NULL REFERENCES variants(id), quantity INTEGER NOT NULL CHECK(quantity > 0), PRIMARY KEY(order_id,variant_id));
    CREATE TABLE IF NOT EXISTS commerce_coupon_holds (order_id TEXT PRIMARY KEY REFERENCES commerce_orders(id), code TEXT NOT NULL REFERENCES coupons(code));
    CREATE TABLE IF NOT EXISTS commerce_events (id TEXT PRIMARY KEY, kind TEXT NOT NULL, document TEXT NOT NULL, created_ms BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS commerce_shipments (order_id TEXT PRIMARY KEY REFERENCES commerce_orders(id), document TEXT NOT NULL, status TEXT NOT NULL, updated_ms BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS commerce_translations (id TEXT PRIMARY KEY, resource TEXT NOT NULL, locale TEXT NOT NULL, source_hash TEXT NOT NULL, source TEXT NOT NULL, draft TEXT, published TEXT, published_hash TEXT, revision INTEGER NOT NULL DEFAULT 1, updated_ms BIGINT NOT NULL, UNIQUE(resource,locale));
    CREATE TABLE IF NOT EXISTS commerce_translation_history (id TEXT PRIMARY KEY, translation_id TEXT NOT NULL REFERENCES commerce_translations(id), document TEXT NOT NULL, created_ms BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS commerce_jobs (id TEXT PRIMARY KEY, dedupe_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, document TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, run_ms BIGINT NOT NULL, lease_ms BIGINT NOT NULL DEFAULT 0, error TEXT, created_ms BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS commerce_campaigns (id TEXT PRIMARY KEY, document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS commerce_audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, document TEXT NOT NULL, created_ms BIGINT NOT NULL);
    CREATE INDEX IF NOT EXISTS commerce_jobs_ready ON commerce_jobs(status,run_ms);
    CREATE INDEX IF NOT EXISTS commerce_orders_expiry ON commerce_orders(inventory_status,reserved_until);
  `);
  const settings = key => {
    try { return db.prepare('SELECT value FROM store_settings WHERE key=?').get(key)?.value; } catch { return null; }
  };

  // Preserve existing retail delivery settings; activation requires explicit operator verification.
  const indiaMarket = { code:'IN', name:'India', covered:false, enabled:false, currency:'INR', language:'en', approvedCurrencies:['INR'], taxApproved:false, taxPercent:0, taxInclusive:true, exportApproved:false, duties:'recipient', shipping:'flat', flatPaise:Number(settings('shipping_flat_fee_paise') || 9900), freeAbovePaise:Number(settings('free_shipping_threshold_paise') || 150000), handlingPaise:0, subsidyPaise:0, fxMarkupBps:0, roundingMinor:1, blockedPostcodes:[], blockedStates:[], blockedSkus:[], cod:{enabled:false,postcodes:[],minPaise:0,maxPaise:100000,feePaise:0,blockedSkus:[]} };
  db.prepare('INSERT INTO commerce_markets (code,document) VALUES (?,?) ON CONFLICT(code) DO NOTHING').run('IN', JSON.stringify(indiaMarket));
}
export function down() {}
