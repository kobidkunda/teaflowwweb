import { getDb } from "@/lib/db";

export interface WebhookDeliveryRow {
  id: string;
  event_type: string;
  channel: "email" | "webhook";
  target: string;
  status: "queued" | "sent" | "failed";
  http_status: number | null;
  attempts: number;
  last_error: string | null;
  payload_preview: string | null;
  created_at: string;
  delivered_at: string | null;
}

export function ensureWebhookDeliveriesTable() {
  const db = getDb();
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
  `);
}

export function recordDeliveryQueued(input: {
  id: string;
  eventType: string;
  channel: "email" | "webhook";
  target: string;
  payloadPreview?: string;
}) {
  try {
    ensureWebhookDeliveriesTable();
    getDb()
      .prepare(
        `INSERT OR IGNORE INTO webhook_deliveries (id, event_type, channel, target, status, attempts, payload_preview)
         VALUES (?, ?, ?, ?, 'queued', 0, ?)`
      )
      .run(
        input.id,
        input.eventType,
        input.channel,
        input.target,
        input.payloadPreview ? input.payloadPreview.slice(0, 500) : null
      );
  } catch {
    // Non-fatal: logging failure must never block business flow
  }
}

export function markDeliverySent(id: string, httpStatus: number | null = null) {
  try {
    ensureWebhookDeliveriesTable();
    getDb()
      .prepare(
        `UPDATE webhook_deliveries
         SET status = 'sent', http_status = ?, attempts = attempts + 1, last_error = NULL, delivered_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(httpStatus, id);
  } catch {
    // Non-fatal
  }
}

export function markDeliveryFailed(id: string, error: string, httpStatus: number | null = null) {
  try {
    ensureWebhookDeliveriesTable();
    getDb()
      .prepare(
        `UPDATE webhook_deliveries
         SET status = 'failed', http_status = ?, attempts = attempts + 1, last_error = ?
         WHERE id = ?`
      )
      .run(httpStatus, error.slice(0, 500), id);
  } catch {
    // Non-fatal
  }
}

export function listRecentDeliveries(limit = 30): WebhookDeliveryRow[] {
  try {
    ensureWebhookDeliveriesTable();
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    return getDb()
      .prepare(
        `SELECT id, event_type, channel, target, status, http_status, attempts, last_error, payload_preview, created_at, delivered_at
         FROM webhook_deliveries
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`
      )
      .all(safeLimit) as WebhookDeliveryRow[];
  } catch {
    return [];
  }
}
