// 019: Abandoned carts, visitor device fingerprints, captured leads & advanced coupon engine
// Additive, versioned, 100% idempotent via CREATE IF NOT EXISTS and PRAGMA table_info.

export function up(db) {
  // 1. visitor_fingerprints: non-invasive client device signals + server IP enrichment
  db.exec(`
    CREATE TABLE IF NOT EXISTS visitor_fingerprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      fingerprint_hash TEXT NOT NULL,
      canvas_hash TEXT DEFAULT '',
      webgl_renderer TEXT DEFAULT '',
      audio_signature TEXT DEFAULT '',
      screen_resolution TEXT DEFAULT '',
      timezone TEXT DEFAULT 'UTC',
      device_memory REAL DEFAULT NULL,
      hardware_concurrency INTEGER DEFAULT NULL,
      ip_address TEXT NOT NULL DEFAULT '',
      ip_country TEXT DEFAULT 'India',
      ip_region TEXT DEFAULT '',
      ip_city TEXT DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      phone_number TEXT DEFAULT NULL,
      customer_name TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_visitor_fingerprints_hash ON visitor_fingerprints(fingerprint_hash);
    CREATE INDEX IF NOT EXISTS idx_visitor_fingerprints_phone ON visitor_fingerprints(phone_number);
    CREATE INDEX IF NOT EXISTS idx_visitor_fingerprints_updated ON visitor_fingerprints(updated_at DESC);
  `);

  // 2. abandoned_carts: synchronized cart lifecycle state & recovery tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS abandoned_carts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      customer_phone TEXT DEFAULT NULL,
      customer_name TEXT DEFAULT NULL,
      customer_email TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'abandoned', 'contacted', 'converted', 'ignored')),
      subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_paise >= 0),
      item_count INTEGER NOT NULL DEFAULT 0 CHECK(item_count >= 0),
      applied_coupon_code TEXT REFERENCES coupons(code),
      recovery_token TEXT NOT NULL UNIQUE,
      recovery_channel TEXT DEFAULT 'whatsapp' CHECK(recovery_channel IN ('whatsapp', 'sms', 'email')),
      recovery_sent_at TEXT DEFAULT NULL,
      converted_order_id TEXT REFERENCES orders(id),
      admin_notes TEXT NOT NULL DEFAULT '',
      last_active_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      abandoned_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON abandoned_carts(status, last_active_at DESC);
    CREATE INDEX IF NOT EXISTS idx_abandoned_carts_phone ON abandoned_carts(customer_phone);
    CREATE INDEX IF NOT EXISTS idx_abandoned_carts_session ON abandoned_carts(session_id);
    CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovery ON abandoned_carts(recovery_token);
  `);

  // 3. cart_items: individual items linked to an abandoned/active cart
  db.exec(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id TEXT NOT NULL REFERENCES abandoned_carts(id) ON DELETE CASCADE,
      variant_id INTEGER NOT NULL REFERENCES variants(id),
      quantity INTEGER NOT NULL CHECK(quantity > 0 AND quantity <= 20),
      unit_price_paise INTEGER NOT NULL CHECK(unit_price_paise >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
    CREATE INDEX IF NOT EXISTS idx_cart_items_variant ON cart_items(variant_id);
  `);

  // 4. captured_leads: high-intent phone numbers captured from modal/exit-intent
  db.exec(`
    CREATE TABLE IF NOT EXISTS captured_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      customer_name TEXT DEFAULT '',
      session_id TEXT NOT NULL,
      cart_id TEXT REFERENCES abandoned_carts(id),
      provisioned_coupon TEXT REFERENCES coupons(code),
      source TEXT NOT NULL DEFAULT 'exit_intent' CHECK(source IN ('exit_intent', 'cart_incentive', 'manual')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_captured_leads_phone ON captured_leads(phone_number);
    CREATE INDEX IF NOT EXISTS idx_captured_leads_session ON captured_leads(session_id);
    CREATE INDEX IF NOT EXISTS idx_captured_leads_created ON captured_leads(created_at DESC);
  `);

  // 5. coupons additive columns (max discount cap, per-user limits, single-use restriction, rule type)
  const couponCols = new Set(
    db.prepare("PRAGMA table_info(coupons)").all().map((c) => c.name)
  );
  if (!couponCols.has("max_discount_paise")) {
    db.exec("ALTER TABLE coupons ADD COLUMN max_discount_paise INTEGER CHECK(max_discount_paise IS NULL OR max_discount_paise > 0);");
  }
  if (!couponCols.has("per_user_limit")) {
    db.exec("ALTER TABLE coupons ADD COLUMN per_user_limit INTEGER NOT NULL DEFAULT 1 CHECK(per_user_limit > 0);");
  }
  if (!couponCols.has("single_use_per_customer")) {
    db.exec("ALTER TABLE coupons ADD COLUMN single_use_per_customer INTEGER NOT NULL DEFAULT 0 CHECK(single_use_per_customer IN (0, 1));");
  }
  if (!couponCols.has("rule_type")) {
    db.exec("ALTER TABLE coupons ADD COLUMN rule_type TEXT NOT NULL DEFAULT 'standard' CHECK(rule_type IN ('standard', 'lead_incentive', 'exclusive_sample'));");
  }

  // 6. coupon_redemptions: atomic audit table preventing customer reuse
  db.exec(`
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_code TEXT NOT NULL REFERENCES coupons(code),
      order_id TEXT REFERENCES orders(id),
      customer_phone TEXT DEFAULT NULL,
      customer_email TEXT DEFAULT NULL,
      customer_fingerprint TEXT DEFAULT NULL,
      discount_paise INTEGER NOT NULL DEFAULT 0 CHECK(discount_paise >= 0),
      redeemed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_phone ON coupon_redemptions(coupon_code, customer_phone);
    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_email ON coupon_redemptions(coupon_code, customer_email);
    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order ON coupon_redemptions(order_id);
  `);

  // 7. orders additive column: customer_phone
  const orderCols = new Set(
    db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name)
  );
  if (!orderCols.has("customer_phone")) {
    db.exec("ALTER TABLE orders ADD COLUMN customer_phone TEXT DEFAULT NULL;");
  }

  // 8. Provision default lead incentive coupon (COMEBACK10) & operational settings idempotently
  db.prepare(`
    INSERT OR IGNORE INTO coupons (
      code, kind, value, min_subtotal_paise, max_uses, used_count,
      is_active, max_discount_paise, per_user_limit, single_use_per_customer, rule_type
    ) VALUES (
      'COMEBACK10', 'percent', 10, 0, NULL, 0,
      1, 50000, 1, 1, 'lead_incentive'
    )
  `).run();

  const settingsDefaults = [
    ["abandoned_cart_threshold_minutes", "30"],
    ["abandoned_lead_coupon_code", "COMEBACK10"],
    ["abandoned_lead_discount_percent", "10"],
  ];
  const setStmt = db.prepare(`
    INSERT OR IGNORE INTO store_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `);
  for (const [k, v] of settingsDefaults) {
    setStmt.run(k, v);
  }
}

export function down() {}
