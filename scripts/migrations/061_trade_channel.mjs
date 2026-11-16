// 061: TeaFloww Trade (/tea-shops) Channel — Versioned Offers, Lanes, Quotes,
// Enquiries, Localised Content, Trade Orders, Shared Pilots, Reminders & Funnel.
// Additive, versioned, idempotent for SQLite.

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trade_settings (
      id TEXT PRIMARY KEY,
      channel_enabled INTEGER NOT NULL DEFAULT 1,
      enabled_locales_json TEXT NOT NULL DEFAULT '["en","bn","hi","gu","mr"]',
      staged_locales_json TEXT NOT NULL DEFAULT '["pa","ta","te","kn"]',
      featured_trial_id TEXT DEFAULT NULL,
      trial_parcel_rate_paise INTEGER NOT NULL DEFAULT 0,
      trial_credit_paise INTEGER NOT NULL DEFAULT 0,
      trial_credit_min_qty_kg INTEGER NOT NULL DEFAULT 25,
      trial_credit_expiry_days INTEGER NOT NULL DEFAULT 30,
      whatsapp_number TEXT NOT NULL DEFAULT '+917001304853',
      support_hours TEXT NOT NULL DEFAULT 'Mon-Sat 9:00 AM - 7:00 PM IST',
      dispatch_cutoff_label TEXT NOT NULL DEFAULT 'Dispatched next business day from Siliguri',
      hero_image_url TEXT NOT NULL DEFAULT '/images/trials/discovery-shelf-hero.webp',
      hero_video_url TEXT DEFAULT NULL,
      hero_video_poster_url TEXT DEFAULT NULL,
      trial_image_url TEXT NOT NULL DEFAULT '/images/trials/discovery-shelf-hero.webp',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trade_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      featured_order INTEGER NOT NULL DEFAULT 0,
      eligible_variant_ids_json TEXT NOT NULL DEFAULT '[]',
      default_variant_id INTEGER DEFAULT NULL,
      starts_at TEXT DEFAULT NULL,
      ends_at TEXT DEFAULT NULL,
      published INTEGER NOT NULL DEFAULT 1,
      badge_text TEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_trade_offers_order ON trade_offers(published, featured_order);

    CREATE TABLE IF NOT EXISTS trade_lanes (
      id TEXT PRIMARY KEY,
      lane_code TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      origin_pin TEXT NOT NULL DEFAULT '734015',
      pin_start TEXT NOT NULL,
      pin_end TEXT NOT NULL,
      service_code TEXT NOT NULL,
      service_label TEXT NOT NULL,
      handover_kind TEXT NOT NULL CHECK(handover_kind IN ('doorstep','depot')),
      locality_label TEXT NOT NULL DEFAULT '',
      depot_name TEXT DEFAULT NULL,
      depot_address TEXT DEFAULT NULL,
      onward_included INTEGER NOT NULL DEFAULT 0,
      billed_weight_rule TEXT NOT NULL DEFAULT 'max_gross_dim',
      dim_divisor INTEGER NOT NULL DEFAULT 5000,
      billing_increment_grams INTEGER NOT NULL DEFAULT 1000,
      tare_grams INTEGER NOT NULL DEFAULT 600,
      box_length_cm INTEGER NOT NULL DEFAULT 40,
      box_width_cm INTEGER NOT NULL DEFAULT 30,
      box_height_cm INTEGER NOT NULL DEFAULT 30,
      max_net_grams INTEGER NOT NULL DEFAULT 30000,
      max_billed_grams INTEGER NOT NULL DEFAULT 30000,
      base_freight_paise INTEGER NOT NULL DEFAULT 0,
      per_kg_freight_paise INTEGER NOT NULL DEFAULT 0,
      last_mile_paise INTEGER NOT NULL DEFAULT 0,
      extra_tax_bps INTEGER NOT NULL DEFAULT 0,
      other_fees_paise INTEGER NOT NULL DEFAULT 0,
      cod_allowed INTEGER NOT NULL DEFAULT 0,
      cod_fee_paise INTEGER NOT NULL DEFAULT 0,
      cod_max_total_paise INTEGER DEFAULT NULL,
      freight_advance_allowed INTEGER NOT NULL DEFAULT 0,
      eta_label TEXT NOT NULL DEFAULT '2-4 business days',
      operator_name TEXT DEFAULT NULL,
      starts_at TEXT DEFAULT NULL,
      ends_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_trade_lanes_active ON trade_lanes(is_active, service_code, pin_start, pin_end);
    CREATE INDEX IF NOT EXISTS idx_trade_lanes_code ON trade_lanes(lane_code, version DESC);

    CREATE TABLE IF NOT EXISTS trade_quotes (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL DEFAULT 'trade',
      session_id TEXT NOT NULL,
      locale TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('confirmed','manual','unavailable')),
      quote_type TEXT NOT NULL CHECK(quote_type IN ('bulk','trial')),
      input_hash TEXT NOT NULL,
      destination_pin TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      lane_id TEXT DEFAULT NULL,
      lane_version INTEGER DEFAULT NULL,
      handover_json TEXT DEFAULT NULL,
      lines_json TEXT NOT NULL,
      net_grams INTEGER NOT NULL DEFAULT 0,
      billed_grams INTEGER NOT NULL DEFAULT 0,
      goods_paise INTEGER NOT NULL DEFAULT 0,
      freight_paise INTEGER NOT NULL DEFAULT 0,
      extra_tax_paise INTEGER NOT NULL DEFAULT 0,
      other_fees_paise INTEGER NOT NULL DEFAULT 0,
      credit_paise INTEGER NOT NULL DEFAULT 0,
      total_paise INTEGER NOT NULL DEFAULT 0,
      due_now_paise INTEGER NOT NULL DEFAULT 0,
      due_later_paise INTEGER NOT NULL DEFAULT 0,
      eta_label TEXT DEFAULT NULL,
      enquiry_draft TEXT DEFAULT NULL,
      expires_at TEXT NOT NULL,
      converted_order_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_trade_quotes_session ON trade_quotes(session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trade_quotes_expires ON trade_quotes(expires_at);

    CREATE TABLE IF NOT EXISTS trade_enquiries (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT NOT NULL UNIQUE,
      session_id TEXT DEFAULT NULL,
      locale TEXT NOT NULL DEFAULT 'en',
      destination_pin TEXT NOT NULL,
      enquiry_type TEXT NOT NULL DEFAULT 'bulk',
      lines_json TEXT NOT NULL DEFAULT '[]',
      contact_name TEXT DEFAULT NULL,
      contact_phone TEXT NOT NULL,
      preferred_hours TEXT DEFAULT NULL,
      consent_given INTEGER NOT NULL DEFAULT 1,
      whatsapp_draft TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      assigned_owner TEXT DEFAULT NULL,
      converted_quote_id TEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_trade_enquiries_status ON trade_enquiries(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS trade_localized_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_key TEXT NOT NULL,
      locale TEXT NOT NULL,
      source_revision INTEGER NOT NULL DEFAULT 1,
      text_value TEXT NOT NULL,
      audio_url TEXT DEFAULT NULL,
      transcript TEXT DEFAULT NULL,
      review_status TEXT NOT NULL DEFAULT 'reviewed',
      updated_by TEXT DEFAULT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(resource_key, locale)
    );
    CREATE INDEX IF NOT EXISTS idx_trade_l10n_locale ON trade_localized_content(locale, review_status);

    CREATE TABLE IF NOT EXISTS trade_orders (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      quote_id TEXT NOT NULL REFERENCES trade_quotes(id),
      access_token TEXT NOT NULL,
      locale TEXT NOT NULL,
      destination_pin TEXT NOT NULL,
      payment_mode TEXT NOT NULL,
      handover_json TEXT NOT NULL,
      goods_paise INTEGER NOT NULL,
      freight_paise INTEGER NOT NULL,
      extra_tax_paise INTEGER NOT NULL,
      other_fees_paise INTEGER NOT NULL,
      credit_paise INTEGER NOT NULL,
      total_paise INTEGER NOT NULL,
      due_now_paise INTEGER NOT NULL,
      due_later_paise INTEGER NOT NULL,
      remittance_status TEXT NOT NULL DEFAULT 'none',
      remitted_paise INTEGER NOT NULL DEFAULT 0,
      credit_redeemed_key TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_trade_orders_order ON trade_orders(order_id);
    CREATE INDEX IF NOT EXISTS idx_trade_orders_quote ON trade_orders(quote_id);

    CREATE TABLE IF NOT EXISTS trade_shared_pilots (
      id TEXT PRIMARY KEY,
      town_name TEXT NOT NULL,
      pin_prefix TEXT NOT NULL,
      collection_point TEXT NOT NULL,
      collection_address TEXT NOT NULL,
      local_fee_paise INTEGER NOT NULL DEFAULT 0,
      cutoff_at TEXT NOT NULL,
      dispatch_partner TEXT NOT NULL,
      dispatch_schedule TEXT NOT NULL,
      target_kg INTEGER NOT NULL DEFAULT 200,
      booked_kg INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trade_shared_interests (
      id TEXT PRIMARY KEY,
      pilot_id TEXT NOT NULL REFERENCES trade_shared_pilots(id) ON DELETE CASCADE,
      contact_name TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      requested_kg INTEGER NOT NULL CHECK(requested_kg > 0),
      locale TEXT NOT NULL DEFAULT 'en',
      status TEXT NOT NULL DEFAULT 'interested',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_trade_shared_interests_pilot ON trade_shared_interests(pilot_id, status);

    CREATE TABLE IF NOT EXISTS trade_reorder_reminders (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'en',
      cadence_days INTEGER NOT NULL DEFAULT 15,
      opted_in INTEGER NOT NULL DEFAULT 1,
      next_reminder_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trade_funnel_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'en',
      transaction_id TEXT DEFAULT NULL,
      quote_id TEXT DEFAULT NULL,
      enquiry_id TEXT DEFAULT NULL,
      order_id TEXT DEFAULT NULL,
      value_paise INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_trade_funnel_event ON trade_funnel_events(event_name, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trade_funnel_session ON trade_funnel_events(session_id, created_at DESC);
  `);

  // Seed default trade_settings row
  db.prepare(`
    INSERT OR IGNORE INTO trade_settings (
      id, channel_enabled, enabled_locales_json, staged_locales_json,
      whatsapp_number, support_hours, dispatch_cutoff_label
    ) VALUES (
      'default', 1, '["en","bn","hi","gu","mr"]', '["pa","ta","te","kn"]',
      '+917001304853', 'Mon-Sat 9:00 AM - 7:00 PM IST', 'Dispatched next business day from Siliguri'
    )
  `).run();

  // Seed default pilot lanes (editable/versionable in admin, API & MCP)
  db.prepare(`
    INSERT OR IGNORE INTO trade_lanes (
      id, lane_code, version, is_active, origin_pin, pin_start, pin_end,
      service_code, service_label, handover_kind, locality_label,
      billed_weight_rule, dim_divisor, billing_increment_grams, tare_grams,
      box_length_cm, box_width_cm, box_height_cm, max_net_grams, max_billed_grams,
      base_freight_paise, per_kg_freight_paise, last_mile_paise, extra_tax_bps, other_fees_paise,
      cod_allowed, cod_fee_paise, cod_max_total_paise, freight_advance_allowed,
      eta_label, operator_name
    ) VALUES (
      'lane-siliguri-doorstep-v1', 'SILIGURI-DOORSTEP', 1, 1, '734015', '734001', '734099',
      'surface_doorstep', 'Siliguri Local Shop Delivery', 'doorstep', 'Siliguri & Jalpaiguri',
      'max_gross_dim', 5000, 1000, 600,
      40, 30, 30, 30000, 30000,
      90000, 0, 0, 0, 0,
      1, 9000, 2500000, 1,
      '1-2 business days', 'Siliguri Local Van'
    )
  `).run();

  db.prepare(`
    INSERT OR IGNORE INTO trade_lanes (
      id, lane_code, version, is_active, origin_pin, pin_start, pin_end,
      service_code, service_label, handover_kind, locality_label,
      depot_name, depot_address, onward_included,
      billed_weight_rule, dim_divisor, billing_increment_grams, tare_grams,
      box_length_cm, box_width_cm, box_height_cm, max_net_grams, max_billed_grams,
      base_freight_paise, per_kg_freight_paise, last_mile_paise, extra_tax_bps, other_fees_paise,
      cod_allowed, cod_fee_paise, cod_max_total_paise, freight_advance_allowed,
      eta_label, operator_name
    ) VALUES (
      'lane-kolkata-depot-v1', 'KOLKATA-DEPOT', 1, 1, '734015', '700001', '700150',
      'transport_depot', 'Kolkata Transport Depot', 'depot', 'Kolkata',
      'Burrabazar Tea Transport Depot', '14 Strand Road, Burrabazar, Kolkata 700001', 0,
      'max_gross_dim', 5000, 1000, 600,
      40, 30, 30, 30000, 30000,
      90000, 0, 0, 0, 0,
      0, 0, NULL, 1,
      '2-3 business days', 'North Bengal Surface'
    )
  `).run();

  db.prepare(`
    INSERT OR IGNORE INTO trade_lanes (
      id, lane_code, version, is_active, origin_pin, pin_start, pin_end,
      service_code, service_label, handover_kind, locality_label,
      billed_weight_rule, dim_divisor, billing_increment_grams, tare_grams,
      box_length_cm, box_width_cm, box_height_cm, max_net_grams, max_billed_grams,
      base_freight_paise, per_kg_freight_paise, last_mile_paise, extra_tax_bps, other_fees_paise,
      cod_allowed, cod_fee_paise, cod_max_total_paise, freight_advance_allowed,
      eta_label, operator_name
    ) VALUES (
      'lane-trial-siliguri-v1', 'TRIAL-SILIGURI', 1, 1, '734015', '734001', '734099',
      'trial_parcel', 'Trial Kit Parcel', 'doorstep', 'Siliguri & Jalpaiguri',
      'gross', 5000, 500, 100,
      25, 20, 10, 2000, 2000,
      0, 0, 0, 0, 0,
      0, 0, NULL, 0,
      '2-3 business days', 'India Post / Local Courier'
    )
  `).run();

  // Auto-assign any published tea-shop / chai products if none assigned yet
  try {
    const existingOffers = db.prepare("SELECT COUNT(*) AS c FROM trade_offers").get();
    if (!existingOffers || existingOffers.c === 0) {
      const products = db
        .prepare("SELECT id FROM products ORDER BY id ASC LIMIT 8")
        .all();
      products.forEach((p, idx) => {
        db.prepare(
          "INSERT OR IGNORE INTO trade_offers (product_id, featured_order, published) VALUES (?, ?, 1)"
        ).run(p.id, idx + 1);
      });
    }
  } catch {
    // Ignore if products table is empty in minimal test DBs
  }
}

export function down() {
  // Additive-only policy
}
