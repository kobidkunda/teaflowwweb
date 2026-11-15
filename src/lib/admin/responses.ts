import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { sendMailHtml } from "@/lib/email";
import { listRecentDeliveries, type WebhookDeliveryRow } from "@/lib/notifications/deliveries";
import { NOTIFICATION_EVENT_TYPES, type NotificationEventType } from "@/lib/notifications/events";
import { getEntityAttribution, recordConversationEvent } from "@/lib/funnel/server";

export const RESPONSE_STATUSES = [
  "new",
  "in_progress",
  "replied",
  "quoted",
  "resolved",
  "archived",
] as const;

export type AdminResponseStatus = (typeof RESPONSE_STATUSES)[number];

export const CONVERSATION_ENTRY_TYPES = [
  "note",
  "reply_email",
  "customer_feedback",
  "status_change",
] as const;

export type ConversationEntryType = (typeof CONVERSATION_ENTRY_TYPES)[number];

export interface AdminResponseItem {
  id: string;
  entityType: NotificationEventType;
  reference: string;
  customerName: string;
  email: string | null;
  phone: string | null;
  summary: string;
  status: string;
  createdAt: string;
  deepLink: string | null;
  payload: Record<string, unknown>;
  attribution?: Record<string, unknown> | null;
}

function resolveAttributionForResponseItem(item: AdminResponseItem): Record<string, unknown> | null {
  try {
    const direct = getEntityAttribution(item.entityType, item.id);
    if (direct) return direct;
    if (item.entityType === "private_label") {
      const sampleAttr = getEntityAttribution("private_label_sample", item.id);
      if (sampleAttr) return sampleAttr;
      const orderAttr = getEntityAttribution("private_label_order", item.id);
      if (orderAttr) return orderAttr;
    }
    if (item.email && tableExists("visitor_sessions")) {
      const row = getDb()
        .prepare(
          `SELECT session_id, funnel_name, funnel_stage,
                  last_utm_source, last_utm_medium, last_utm_campaign, last_utm_term, last_utm_content,
                  last_gclid, last_fbclid, last_landing_page, last_referrer
           FROM visitor_sessions
           WHERE customer_email = ?
           ORDER BY updated_at DESC
           LIMIT 1`
        )
        .get(item.email.trim().toLowerCase()) as Record<string, unknown> | undefined;
      if (row) {
        return {
          sessionId: row.session_id || "",
          funnelName: row.funnel_name || "retail_storefront",
          funnelStage: row.funnel_stage || "",
          utm_source: row.last_utm_source || "",
          utm_medium: row.last_utm_medium || "",
          utm_campaign: row.last_utm_campaign || "",
          utm_term: row.last_utm_term || "",
          utm_content: row.last_utm_content || "",
          gclid: row.last_gclid || "",
          fbclid: row.last_fbclid || "",
          landing_page: row.last_landing_page || "",
          referrer: row.last_referrer || "",
        };
      }
    }
  } catch {}
  return null;
}

export interface AdminConversationEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  entry_type: ConversationEntryType;
  author: string;
  message: string;
  metadata_json: string | null;
  created_at: string;
}

export function ensureAdminResponseTables() {
  try {
    if (tableExists("admin_conversation_entries") && tableExists("admin_response_statuses")) {
      return;
    }
    const db = getDb();
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
  } catch {
    // Tables already managed by PostgreSQL migration in production
  }
}

function tableExists(name: string): boolean {
  try {
    const row = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(name);
    return Boolean(row);
  } catch {
    return false;
  }
}

function statusOverrideMap(entityType?: NotificationEventType): Map<string, string> {
  ensureAdminResponseTables();
  const rows = entityType
    ? (getDb()
        .prepare("SELECT entity_type, entity_id, status FROM admin_response_statuses WHERE entity_type = ?")
        .all(entityType) as Array<{ entity_type: string; entity_id: string; status: string }>)
    : (getDb()
        .prepare("SELECT entity_type, entity_id, status FROM admin_response_statuses")
        .all() as Array<{ entity_type: string; entity_id: string; status: string }>);
  return new Map(rows.map((r) => [`${r.entity_type}:${r.entity_id}`, r.status]));
}

function resolveStatus(overrides: Map<string, string>, entityType: NotificationEventType, id: string, nativeStatus?: string | null): string {
  return overrides.get(`${entityType}:${id}`) || nativeStatus || "new";
}

function toIso(value: string | number | null | undefined): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === "string" && value.trim()) return value;
  return new Date().toISOString();
}

function loadCategoryItems(entityType: NotificationEventType, limitPerTable: number, overrides: Map<string, string>): AdminResponseItem[] {
  const db = getDb();
  const items: AdminResponseItem[] = [];

  if (entityType === "enquiry" && tableExists("contact_inquiries")) {
    const rows = db
      .prepare("SELECT id, reference_code, name, email, phone, topic, message, order_id, status, created_at FROM contact_inquiries WHERE topic != 'wholesale' ORDER BY id DESC LIMIT ?")
      .all(limitPerTable) as Array<Record<string, unknown>>;
    for (const r of rows) {
      const id = String(r.id);
      items.push({
        id,
        entityType: "enquiry",
        reference: String(r.reference_code || `INQ-${id}`),
        customerName: String(r.name || "Guest"),
        email: r.email ? String(r.email) : null,
        phone: r.phone ? String(r.phone) : null,
        summary: `[${String(r.topic || "general")}] ${String(r.message || "").slice(0, 110)}`,
        status: resolveStatus(overrides, "enquiry", id, r.status ? String(r.status) : "new"),
        createdAt: toIso(r.created_at as string),
        deepLink: null,
        payload: r,
      });
    }
  }

  if (entityType === "bulk_order") {
    if (tableExists("wholesale_inquiries")) {
      const rows = db
        .prepare("SELECT * FROM wholesale_inquiries ORDER BY id DESC LIMIT ?")
        .all(limitPerTable) as Array<Record<string, unknown>>;
      for (const r of rows) {
        const id = `wholesale:${String(r.id)}`;
        items.push({
          id,
          entityType: "bulk_order",
          reference: `WHOLESALE-${String(r.id)}`,
          customerName: `${String(r.name || "")} (${String(r.business_name || "Business")})`,
          email: r.email ? String(r.email) : null,
          phone: r.phone ? String(r.phone) : null,
          summary: `${String(r.estimated_volume || "")} · ${String(r.interest || "")}`,
          status: resolveStatus(overrides, "bulk_order", id, r.status ? String(r.status) : "new"),
          createdAt: toIso(r.created_at as string),
          deepLink: null,
          payload: r,
        });
      }
    }
    if (tableExists("contact_inquiries")) {
      const rows = db
        .prepare("SELECT id, reference_code, name, email, phone, topic, message, order_id, status, created_at FROM contact_inquiries WHERE topic = 'wholesale' ORDER BY id DESC LIMIT ?")
        .all(limitPerTable) as Array<Record<string, unknown>>;
      for (const r of rows) {
        const id = `contact:${String(r.id)}`;
        items.push({
          id,
          entityType: "bulk_order",
          reference: String(r.reference_code || `INQ-${String(r.id)}`),
          customerName: String(r.name || "Guest"),
          email: r.email ? String(r.email) : null,
          phone: r.phone ? String(r.phone) : null,
          summary: String(r.message || "").slice(0, 120),
          status: resolveStatus(overrides, "bulk_order", id, r.status ? String(r.status) : "new"),
          createdAt: toIso(r.created_at as string),
          deepLink: null,
          payload: r,
        });
      }
    }
  }

  if (entityType === "lead_modal" && tableExists("captured_leads")) {
    const rows = db
      .prepare("SELECT * FROM captured_leads ORDER BY id DESC LIMIT ?")
      .all(limitPerTable) as Array<Record<string, unknown>>;
    for (const r of rows) {
      const id = String(r.id);
      items.push({
        id,
        entityType: "lead_modal",
        reference: `LEAD-${id}`,
        customerName: String(r.customer_name || "Modal Visitor"),
        email: null,
        phone: r.phone_number ? String(r.phone_number) : null,
        summary: `Source: ${String(r.source || "exit_intent")} · Coupon: ${String(r.provisioned_coupon || "—")}`,
        status: resolveStatus(overrides, "lead_modal", id, r.status ? String(r.status) : "new"),
        createdAt: toIso(r.created_at as string),
        deepLink: "/admin/abandoned-carts",
        payload: r,
      });
    }
  }

  if (entityType === "newsletter" && tableExists("newsletter_subscriptions")) {
    const rows = db
      .prepare("SELECT * FROM newsletter_subscriptions ORDER BY id DESC LIMIT ?")
      .all(limitPerTable) as Array<Record<string, unknown>>;
    for (const r of rows) {
      const id = String(r.id);
      items.push({
        id,
        entityType: "newsletter",
        reference: `NEWS-${id}`,
        customerName: String(r.email || "Subscriber"),
        email: r.email ? String(r.email) : null,
        phone: null,
        summary: `Consent: ${String(r.consent_version || "homepage-v1")}`,
        status: resolveStatus(overrides, "newsletter", id, r.status ? String(r.status) : "new"),
        createdAt: toIso(r.created_at as string),
        deepLink: null,
        payload: r,
      });
    }
  }

  if (entityType === "private_label") {
    if (tableExists("pl_sample_orders")) {
      const rows = db
        .prepare("SELECT * FROM pl_sample_orders ORDER BY created_at DESC LIMIT ?")
        .all(limitPerTable) as Array<Record<string, unknown>>;
      for (const r of rows) {
        const id = `sample:${String(r.id)}`;
        let addr: Record<string, unknown> = {};
        try {
          addr = JSON.parse(String(r.shipping_address_json || "{}"));
        } catch {}
        items.push({
          id,
          entityType: "private_label",
          reference: String(r.sample_number || r.id),
          customerName: String(addr.name || r.client_id || "Private Label Client"),
          email: addr.email ? String(addr.email) : null,
          phone: addr.phone ? String(addr.phone) : null,
          summary: `Sample: ${String(r.sample_type || "")} (x${String(r.quantity ?? 1)})`,
          status: resolveStatus(overrides, "private_label", id, r.status ? String(r.status) : "new"),
          createdAt: toIso(r.created_at as string),
          deepLink: "/admin/private-label",
          payload: { ...r, shipping_address: addr },
        });
      }
    }
    if (tableExists("blend_lab_projects")) {
      const rows = db
        .prepare("SELECT * FROM blend_lab_projects ORDER BY created_at DESC LIMIT ?")
        .all(limitPerTable) as Array<Record<string, unknown>>;
      for (const r of rows) {
        const id = `blend:${String(r.id)}`;
        items.push({
          id,
          entityType: "private_label",
          reference: String(r.public_id || r.id),
          customerName: String(r.customer_name || r.brand_name || "Blend Lab Draft"),
          email: r.customer_email ? String(r.customer_email) : null,
          phone: r.customer_phone ? String(r.customer_phone) : null,
          summary: `Blend Lab Project (${String(r.status || "draft")})`,
          status: resolveStatus(overrides, "private_label", id, r.status ? String(r.status) : "new"),
          createdAt: toIso(r.created_at as string),
          deepLink: "/admin/blend-lab",
          payload: r,
        });
      }
    }
  }

  if (entityType === "quote" && tableExists("commerce_quotes")) {
    const rows = db
      .prepare("SELECT id, owner, document, expires_ms FROM commerce_quotes ORDER BY expires_ms DESC LIMIT ?")
      .all(limitPerTable) as Array<{ id: string; owner: string; document: string; expires_ms: number }>;
    for (const r of rows) {
      let doc: Record<string, unknown> = {};
      try {
        doc = JSON.parse(r.document);
      } catch {}
      const input = (doc.input || {}) as Record<string, unknown>;
      const addr = (input.address || {}) as Record<string, unknown>;
      const totalPaise = Number(doc.totalPaise || 0);
      const currency = String(doc.currency || "INR");
      items.push({
        id: r.id,
        entityType: "quote",
        reference: r.id.slice(0, 8).toUpperCase(),
        customerName: String(addr.name || r.owner || "Checkout Visitor"),
        email: addr.email ? String(addr.email) : null,
        phone: addr.phone ? String(addr.phone) : null,
        summary: `${currency} ${(totalPaise / 100).toFixed(2)} · ${String(addr.city || "")} ${String(addr.postcode || "")}`.trim(),
        status: resolveStatus(overrides, "quote", r.id, "new"),
        createdAt: toIso(Number(doc.created || r.expires_ms - 15 * 60000)),
        deepLink: null,
        payload: { id: r.id, owner: r.owner, expires_ms: r.expires_ms, ...doc },
      });
    }
  }

  if (entityType === "order") {
    if (tableExists("commerce_orders")) {
      const rows = db
        .prepare("SELECT id, owner, quote_id, document, payment_status, fulfillment_status, created_ms FROM commerce_orders ORDER BY created_ms DESC LIMIT ?")
        .all(limitPerTable) as Array<{ id: string; owner: string; quote_id: string; document: string; payment_status: string; fulfillment_status: string | null; created_ms: number }>;
      for (const r of rows) {
        let doc: Record<string, unknown> = {};
        try {
          doc = JSON.parse(r.document);
        } catch {}
        const input = (doc.input || {}) as Record<string, unknown>;
        const addr = (input.address || {}) as Record<string, unknown>;
        const totalPaise = Number(doc.totalPaise || 0);
        const currency = String(doc.currency || "INR");
        const id = `co:${r.id}`;
        items.push({
          id,
          entityType: "order",
          reference: r.id.slice(0, 8).toUpperCase(),
          customerName: String(addr.name || "Customer"),
          email: addr.email ? String(addr.email) : null,
          phone: addr.phone ? String(addr.phone) : null,
          summary: `${currency} ${(totalPaise / 100).toFixed(2)} · Payment: ${r.payment_status}`,
          status: resolveStatus(overrides, "order", id, r.payment_status),
          createdAt: toIso(r.created_ms),
          deepLink: `/admin/orders/${encodeURIComponent(r.id)}`,
          payload: { id: r.id, quote_id: r.quote_id, payment_status: r.payment_status, fulfillment_status: r.fulfillment_status, ...doc },
        });
      }
    }
    if (tableExists("orders")) {
      const rows = db
        .prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT ?")
        .all(limitPerTable) as Array<Record<string, unknown>>;
      for (const r of rows) {
        const id = `ord:${String(r.id)}`;
        items.push({
          id,
          entityType: "order",
          reference: String(r.id).slice(0, 8).toUpperCase(),
          customerName: String(r.customer_name || "Customer"),
          email: r.customer_email ? String(r.customer_email) : null,
          phone: r.customer_phone ? String(r.customer_phone) : null,
          summary: `INR ${(Number(r.total_paise || 0) / 100).toFixed(2)} · ${String(r.status || "pending")}`,
          status: resolveStatus(overrides, "order", id, r.status ? String(r.status) : "new"),
          createdAt: toIso(r.created_at as string),
          deepLink: `/admin/orders/${encodeURIComponent(String(r.id))}`,
          payload: r,
        });
      }
    }
  }

  if (entityType === "subscription" && tableExists("tea_subscriptions")) {
    const rows = db
      .prepare("SELECT id, customer_id, status, document, next_ms, created_ms FROM tea_subscriptions ORDER BY created_ms DESC LIMIT ?")
      .all(limitPerTable) as Array<{ id: string; customer_id: string; status: string; document: string; next_ms: number; created_ms: number }>;
    for (const r of rows) {
      let doc: Record<string, unknown> = {};
      try {
        doc = JSON.parse(r.document);
      } catch {}
      const input = (doc.input || {}) as Record<string, unknown>;
      const addr = (input.address || {}) as Record<string, unknown>;
      items.push({
        id: r.id,
        entityType: "subscription",
        reference: `SUB-${r.id.slice(0, 8).toUpperCase()}`,
        customerName: String(addr.name || r.customer_id),
        email: addr.email ? String(addr.email) : null,
        phone: addr.phone ? String(addr.phone) : null,
        summary: `Every ${String(doc.intervalDays || "?")}d · Status: ${r.status}`,
        status: resolveStatus(overrides, "subscription", r.id, r.status),
        createdAt: toIso(r.created_ms),
        deepLink: "/admin/subscriptions",
        payload: { id: r.id, customer_id: r.customer_id, db_status: r.status, next_ms: r.next_ms, ...doc },
      });
    }
  }

  return items;
}

export function listAdminResponses(options: {
  type?: NotificationEventType | "all";
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
} = {}): {
  items: AdminResponseItem[];
  counts: Record<string, number>;
  total: number;
} {
  const overrides = statusOverrideMap();
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);
  const query = (options.q || "").trim().toLowerCase();
  const statusFilter = (options.status || "all").trim().toLowerCase();

  const allByType: Record<NotificationEventType, AdminResponseItem[]> = {
    enquiry: loadCategoryItems("enquiry", 60, overrides),
    bulk_order: loadCategoryItems("bulk_order", 60, overrides),
    lead_modal: loadCategoryItems("lead_modal", 60, overrides),
    newsletter: loadCategoryItems("newsletter", 60, overrides),
    private_label: loadCategoryItems("private_label", 60, overrides),
    quote: loadCategoryItems("quote", 60, overrides),
    order: loadCategoryItems("order", 60, overrides),
    subscription: loadCategoryItems("subscription", 60, overrides),
  };

  const counts: Record<string, number> = { all: 0 };
  for (const t of NOTIFICATION_EVENT_TYPES) {
    counts[t] = allByType[t].length;
    counts.all += allByType[t].length;
  }

  let pool: AdminResponseItem[] =
    options.type && options.type !== "all"
      ? allByType[options.type] || []
      : NOTIFICATION_EVENT_TYPES.flatMap((t) => allByType[t]);

  if (statusFilter !== "all") {
    pool = pool.filter((item) => item.status.toLowerCase() === statusFilter);
  }
  if (query) {
    pool = pool.filter((item) =>
      [item.reference, item.customerName, item.email || "", item.phone || "", item.summary]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }

  pool.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pageItems = pool.slice(offset, offset + limit).map((item) => ({
    ...item,
    attribution: resolveAttributionForResponseItem(item),
  }));

  return {
    items: pageItems,
    counts,
    total: pool.length,
  };
}

export function getAdminResponseDetail(entityType: NotificationEventType, id: string): {
  item: AdminResponseItem | null;
  conversation: AdminConversationEntry[];
  deliveries: WebhookDeliveryRow[];
} {
  ensureAdminResponseTables();
  const overrides = statusOverrideMap(entityType);
  const items = loadCategoryItems(entityType, 200, overrides);
  const rawItem = items.find((x) => x.id === id) || null;
  const item = rawItem
    ? { ...rawItem, attribution: resolveAttributionForResponseItem(rawItem) }
    : null;

  const conversation = getDb()
    .prepare(
      `SELECT id, entity_type, entity_id, entry_type, author, message, metadata_json, created_at
       FROM admin_conversation_entries
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY created_at ASC`
    )
    .all(entityType, id) as AdminConversationEntry[];

  const deliveries = listRecentDeliveries(50).filter((d) => d.event_type === entityType);
  return { item, conversation, deliveries };
}

export function updateAdminResponseStatus(
  entityType: NotificationEventType,
  id: string,
  status: AdminResponseStatus,
  author: string
): void {
  ensureAdminResponseTables();
  const db = getDb();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO admin_response_statuses (entity_type, entity_id, status, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(entity_type, entity_id) DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP`
    ).run(entityType, id, status);

    if (entityType === "enquiry" && tableExists("contact_inquiries")) {
      db.prepare("UPDATE contact_inquiries SET status = ? WHERE id = ?").run(status, Number(id));
    } else if (entityType === "bulk_order") {
      if (id.startsWith("wholesale:") && tableExists("wholesale_inquiries")) {
        db.prepare("UPDATE wholesale_inquiries SET status = ? WHERE id = ?").run(status, Number(id.slice("wholesale:".length)));
      } else if (id.startsWith("contact:") && tableExists("contact_inquiries")) {
        db.prepare("UPDATE contact_inquiries SET status = ? WHERE id = ?").run(status, Number(id.slice("contact:".length)));
      }
    }

    db.prepare(
      `INSERT INTO admin_conversation_entries (id, entity_type, entity_id, entry_type, author, message, metadata_json)
       VALUES (?, ?, ?, 'status_change', ?, ?, ?)`
    ).run(
      randomUUID(),
      entityType,
      id,
      author,
      `Status changed to "${status}"`,
      JSON.stringify({ status })
    );
  })();
}

export async function addAdminConversationEntry(input: {
  entityType: NotificationEventType;
  entityId: string;
  entryType: Exclude<ConversationEntryType, "status_change">;
  author: string;
  message: string;
  sendEmailTo?: string | null;
  subject?: string;
}): Promise<{ entry: AdminConversationEntry; emailSent: boolean }> {
  ensureAdminResponseTables();
  const db = getDb();
  const entryId = randomUUID();
  let emailSent = false;

  if (input.entryType === "reply_email" && input.sendEmailTo) {
    const { buildBrandEmailHtml } = await import("@/lib/emailLayout");
    const { defaultEmailContext } = await import("@/lib/emailTemplates");
    const ctx = defaultEmailContext();
    const escape = (s: string) =>
      s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

    const html = buildBrandEmailHtml({
      categoryBadge: "Customer Support Desk",
      heading: input.subject || "Message from TeaFloww",
      leadParagraph:
        "A specialist from our Siliguri tasting and support team has responded to your message:",
      bodyHtml: `<div style="padding:16px 18px;background:#fbfbf9;border-left:3px solid #143c31;border-radius:4px;margin:16px 0;font-size:14px;line-height:1.6;color:#1d2a24;white-space:pre-wrap;">${escape(
        input.message
      )}</div>`,
      table: {
        caption: "Response Details",
        columns: ["Detail", "Information"],
        rows: [
          ["Representative", escape(input.author)],
          ["Support Desk", ctx.support_email],
          ["Dispatch / Origin Hub", "Siliguri, West Bengal"],
        ],
      },
      secondaryNoteHtml:
        "You can reply directly to this email to continue the conversation with our team.",
    })
      .replaceAll("{{logo_url}}", ctx.logo_url)
      .replaceAll("{{store_name}}", ctx.store_name)
      .replaceAll("{{support_email}}", ctx.support_email)
      .replaceAll(/\{\{#logo\}\}([\s\S]*?)\{\{\/logo\}\}/g, "$1");

    const res = await sendMailHtml({
      to: input.sendEmailTo,
      subject: input.subject || "Reply from TeaFloww",
      text: input.message,
      html,
    });
    emailSent = res.sent;
  }

  db.prepare(
    `INSERT INTO admin_conversation_entries (id, entity_type, entity_id, entry_type, author, message, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entryId,
    input.entityType,
    input.entityId,
    input.entryType,
    input.author,
    input.message.trim(),
    input.sendEmailTo ? JSON.stringify({ to: input.sendEmailTo, emailSent }) : null
  );

  if (input.entryType === "reply_email") {
    db.prepare(
      `INSERT INTO admin_response_statuses (entity_type, entity_id, status, updated_at)
       VALUES (?, ?, 'replied', CURRENT_TIMESTAMP)
       ON CONFLICT(entity_type, entity_id) DO UPDATE SET status = CASE WHEN admin_response_statuses.status IN ('new', 'in_progress') THEN 'replied' ELSE admin_response_statuses.status END, updated_at = CURRENT_TIMESTAMP`
    ).run(input.entityType, input.entityId);
  }

  const entry = db
    .prepare("SELECT * FROM admin_conversation_entries WHERE id = ?")
    .get(entryId) as AdminConversationEntry;

  if (input.entryType === "customer_feedback" || input.entryType === "reply_email") {
    try {
      const existingAttr = getEntityAttribution(input.entityType, input.entityId);
      recordConversationEvent({
        sessionId: typeof existingAttr?.sessionId === "string" && existingAttr.sessionId ? existingAttr.sessionId : undefined,
        channel: input.entryType === "customer_feedback" ? "customer_feedback" : "admin_inbox_reply",
        sourcePage: "/admin/responses",
        referenceCode: input.entityId,
        customerEmail: input.sendEmailTo || null,
        messagePreview: input.message.trim().slice(0, 180),
        linkedEntityType: input.entityType,
        linkedEntityId: input.entityId,
      });
    } catch {}
  }

  return { entry, emailSent };
}
