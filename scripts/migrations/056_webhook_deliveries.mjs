// 056: Add webhook_deliveries table for tracking outbound notification emails and webhook dispatches.
// Additive, versioned, and idempotent.

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      channel TEXT NOT NULL CHECK(channel IN ('email', 'webhook')),
      target TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('queued', 'sent', 'failed')),
      http_status INTEGER DEFAULT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT DEFAULT NULL,
      payload_preview TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      delivered_at TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_type, status);
  `);
}

export function down() {
  // Additive migration; no destructive down step.
}
