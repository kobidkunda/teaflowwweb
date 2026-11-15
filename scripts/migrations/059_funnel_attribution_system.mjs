// 059: Unified Funnel, UTM/Keyword Attribution, Conversations & Remarketing System
// Additive, versioned, idempotent for SQLite.

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS visitor_sessions (
      session_id TEXT PRIMARY KEY,
      first_utm_source TEXT NOT NULL DEFAULT '',
      first_utm_medium TEXT NOT NULL DEFAULT '',
      first_utm_campaign TEXT NOT NULL DEFAULT '',
      first_utm_term TEXT NOT NULL DEFAULT '',
      first_utm_content TEXT NOT NULL DEFAULT '',
      first_utm_id TEXT NOT NULL DEFAULT '',
      first_gclid TEXT NOT NULL DEFAULT '',
      first_fbclid TEXT NOT NULL DEFAULT '',
      first_click_ids_json TEXT NOT NULL DEFAULT '{}',
      first_referrer TEXT NOT NULL DEFAULT '',
      first_landing_page TEXT NOT NULL DEFAULT '',
      first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_utm_source TEXT NOT NULL DEFAULT '',
      last_utm_medium TEXT NOT NULL DEFAULT '',
      last_utm_campaign TEXT NOT NULL DEFAULT '',
      last_utm_term TEXT NOT NULL DEFAULT '',
      last_utm_content TEXT NOT NULL DEFAULT '',
      last_utm_id TEXT NOT NULL DEFAULT '',
      last_gclid TEXT NOT NULL DEFAULT '',
      last_fbclid TEXT NOT NULL DEFAULT '',
      last_click_ids_json TEXT NOT NULL DEFAULT '{}',
      last_referrer TEXT NOT NULL DEFAULT '',
      last_landing_page TEXT NOT NULL DEFAULT '',
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fbc TEXT DEFAULT NULL,
      fbp TEXT DEFAULT NULL,
      marketing_consent INTEGER NOT NULL DEFAULT 0,
      analytics_consent INTEGER NOT NULL DEFAULT 0,
      customer_id TEXT DEFAULT NULL,
      customer_name TEXT DEFAULT NULL,
      customer_email TEXT DEFAULT NULL,
      customer_phone TEXT DEFAULT NULL,
      funnel_name TEXT NOT NULL DEFAULT 'retail_storefront',
      highest_stage TEXT NOT NULL DEFAULT 'visit',
      stage_rank INTEGER NOT NULL DEFAULT 1,
      converted_order_id TEXT DEFAULT NULL,
      converted_revenue_paise INTEGER NOT NULL DEFAULT 0,
      device_type TEXT NOT NULL DEFAULT 'unknown',
      ip_country TEXT NOT NULL DEFAULT '',
      ip_region TEXT NOT NULL DEFAULT '',
      ip_city TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_vs_first_campaign ON visitor_sessions(first_utm_campaign, first_utm_source);
    CREATE INDEX IF NOT EXISTS idx_vs_last_campaign ON visitor_sessions(last_utm_campaign, last_utm_source);
    CREATE INDEX IF NOT EXISTS idx_vs_stage ON visitor_sessions(highest_stage, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_vs_email ON visitor_sessions(customer_email);
    CREATE INDEX IF NOT EXISTS idx_vs_phone ON visitor_sessions(customer_phone);
    CREATE INDEX IF NOT EXISTS idx_vs_updated ON visitor_sessions(updated_at DESC);

    CREATE TABLE IF NOT EXISTS funnel_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      event_id TEXT DEFAULT NULL,
      funnel_name TEXT NOT NULL DEFAULT 'retail_storefront',
      funnel_stage TEXT NOT NULL,
      stage_rank INTEGER NOT NULL DEFAULT 1,
      event_name TEXT NOT NULL,
      entity_type TEXT DEFAULT NULL,
      entity_id TEXT DEFAULT NULL,
      path TEXT NOT NULL DEFAULT '/',
      value_paise INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      utm_source TEXT NOT NULL DEFAULT '',
      utm_medium TEXT NOT NULL DEFAULT '',
      utm_campaign TEXT NOT NULL DEFAULT '',
      utm_term TEXT NOT NULL DEFAULT '',
      utm_content TEXT NOT NULL DEFAULT '',
      gclid TEXT NOT NULL DEFAULT '',
      fbclid TEXT NOT NULL DEFAULT '',
      referrer TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_fe_session_created ON funnel_events(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_fe_stage_created ON funnel_events(funnel_stage, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_fe_campaign_source ON funnel_events(utm_campaign, utm_source);
    CREATE INDEX IF NOT EXISTS idx_fe_entity ON funnel_events(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_fe_created ON funnel_events(created_at DESC);

    CREATE TABLE IF NOT EXISTS funnel_conversations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL,
      source_page TEXT NOT NULL DEFAULT '/',
      reference_code TEXT DEFAULT NULL,
      customer_name TEXT DEFAULT NULL,
      customer_email TEXT DEFAULT NULL,
      customer_phone TEXT DEFAULT NULL,
      message_preview TEXT NOT NULL DEFAULT '',
      linked_entity_type TEXT DEFAULT NULL,
      linked_entity_id TEXT DEFAULT NULL,
      utm_source TEXT NOT NULL DEFAULT '',
      utm_medium TEXT NOT NULL DEFAULT '',
      utm_campaign TEXT NOT NULL DEFAULT '',
      utm_term TEXT NOT NULL DEFAULT '',
      utm_content TEXT NOT NULL DEFAULT '',
      gclid TEXT NOT NULL DEFAULT '',
      fbclid TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_fc_session ON funnel_conversations(session_id);
    CREATE INDEX IF NOT EXISTS idx_fc_channel ON funnel_conversations(channel, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_fc_created ON funnel_conversations(created_at DESC);

    CREATE TABLE IF NOT EXISTS entity_attributions (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      session_id TEXT NOT NULL DEFAULT '',
      funnel_name TEXT NOT NULL DEFAULT 'retail_storefront',
      funnel_stage TEXT NOT NULL DEFAULT 'form_submit',
      utm_source TEXT NOT NULL DEFAULT '',
      utm_medium TEXT NOT NULL DEFAULT '',
      utm_campaign TEXT NOT NULL DEFAULT '',
      utm_term TEXT NOT NULL DEFAULT '',
      utm_content TEXT NOT NULL DEFAULT '',
      utm_id TEXT NOT NULL DEFAULT '',
      gclid TEXT NOT NULL DEFAULT '',
      fbclid TEXT NOT NULL DEFAULT '',
      landing_page TEXT NOT NULL DEFAULT '',
      referrer TEXT NOT NULL DEFAULT '',
      first_touch_json TEXT NOT NULL DEFAULT '{}',
      last_touch_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entity_type, entity_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ea_session ON entity_attributions(session_id);
    CREATE INDEX IF NOT EXISTS idx_ea_campaign ON entity_attributions(utm_campaign, utm_source);
    CREATE INDEX IF NOT EXISTS idx_ea_created ON entity_attributions(created_at DESC);
  `);

  const targetTables = [
    "abandoned_carts",
    "captured_leads",
    "contact_inquiries",
    "wholesale_inquiries",
    "newsletter_subscriptions",
    "orders",
  ];

  const attributionColumns = [
    ["session_id", "TEXT DEFAULT NULL"],
    ["utm_source", "TEXT NOT NULL DEFAULT ''"],
    ["utm_medium", "TEXT NOT NULL DEFAULT ''"],
    ["utm_campaign", "TEXT NOT NULL DEFAULT ''"],
    ["utm_term", "TEXT NOT NULL DEFAULT ''"],
    ["utm_content", "TEXT NOT NULL DEFAULT ''"],
    ["gclid", "TEXT NOT NULL DEFAULT ''"],
    ["fbclid", "TEXT NOT NULL DEFAULT ''"],
    ["landing_page", "TEXT NOT NULL DEFAULT ''"],
    ["funnel_name", "TEXT NOT NULL DEFAULT ''"],
  ];

  for (const table of targetTables) {
    const existing = new Set(
      db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
    );
    if (existing.size === 0) continue;
    for (const [col, def] of attributionColumns) {
      if (!existing.has(col)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def};`);
      }
    }
  }
}

export function down() {
  // Additive migration; no destructive down step.
}
