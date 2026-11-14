// 057: Add admin_conversation_entries and admin_response_statuses tables, plus status columns on captured_leads & newsletter_subscriptions.
// Additive, versioned, and idempotent.

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_conversation_entries (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entry_type TEXT NOT NULL CHECK(entry_type IN ('note', 'reply_email', 'customer_feedback', 'status_change')),
      author TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_admin_conv_entity ON admin_conversation_entries(entity_type, entity_id, created_at);

    CREATE TABLE IF NOT EXISTS admin_response_statuses (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entity_type, entity_id)
    );
  `);

  for (const table of ["captured_leads", "newsletter_subscriptions"]) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (cols.length > 0 && !cols.includes("status")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN status TEXT NOT NULL DEFAULT 'new';`);
    }
  }
}

export function down() {
  // Additive migration; no destructive down step.
}
