import { getDb } from "@/lib/db";
import { dispatchNotificationEvent } from "@/lib/notifications/dispatch";
import {
  buildCompactAttributionPayload,
  getTableColumns,
  recordConversationEvent,
  safeRecordEntityAttribution,
  type ExtractedRequestAttribution,
} from "@/lib/funnel/server";
import {
  contactInquirySchema,
  type ContactInquiryInput,
  type ContactInquiryRecord,
  TOPIC_LABELS,
  cleanWhatsAppNumber,
  buildContactWhatsAppUrl,
} from "./contactTypes";

export {
  contactInquirySchema,
  type ContactInquiryInput,
  type ContactInquiryRecord,
  TOPIC_LABELS,
  cleanWhatsAppNumber,
  buildContactWhatsAppUrl,
};

/**
 * Records a customer contact inquiry securely into the database with parameterized queries.
 */
export function recordContactInquiry(
  input: ContactInquiryInput,
  meta?: { ip_hash?: string; user_agent?: string; attribution?: ExtractedRequestAttribution }
): { id: number; referenceCode: string; whatsappUrl: string } {
  const db = getDb();
  // Generate distinct human-readable reference ticket, ensuring no collision
  let referenceCode = `TF-CNT-${Math.floor(100000 + Math.random() * 900000)}`;
  for (let attempt = 0; attempt < 10; attempt++) {
    const existing = db
      .prepare("SELECT 1 FROM contact_inquiries WHERE reference_code = ?")
      .get(referenceCode);
    if (!existing) break;
    referenceCode = `TF-CNT-${Math.floor(100000 + Math.random() * 900000)}`;
  }

  const whatsappUrl = buildContactWhatsAppUrl({
    name: input.name,
    topic: input.topic,
    message: input.message,
    orderId: input.order_id,
    referenceCode,
  });

  // Honeypot check: If bot filled the hidden honeypot input, simulate success without DB pollution
  if (input.honeypot && input.honeypot.trim().length > 0) {
    return { id: 0, referenceCode, whatsappUrl };
  }

  const attr = meta?.attribution;
  const lastTouch = attr?.lastTouch || attr?.firstTouch;
  const cols = getTableColumns(db, "contact_inquiries");

  let info: { lastInsertRowid: number | bigint };
  if (cols.has("utm_source")) {
    const stmt = db.prepare(`
      INSERT INTO contact_inquiries (
        reference_code, name, email, phone, topic, message, order_id, ip_hash, user_agent, status,
        session_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, landing_page, funnel_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    info = stmt.run(
      referenceCode,
      input.name.trim(),
      input.email.trim().toLowerCase(),
      input.phone && input.phone.trim().length > 0 ? input.phone.trim() : null,
      input.topic,
      input.message.trim(),
      input.order_id && input.order_id.trim().length > 0 ? input.order_id.trim() : null,
      meta?.ip_hash || null,
      meta?.user_agent ? meta.user_agent.slice(0, 255) : null,
      attr?.sessionId || null,
      lastTouch?.utm_source || "",
      lastTouch?.utm_medium || "",
      lastTouch?.utm_campaign || "",
      lastTouch?.utm_term || "",
      lastTouch?.utm_content || "",
      lastTouch?.gclid || "",
      lastTouch?.fbclid || "",
      lastTouch?.landing_page || "",
      attr?.funnelName || (input.topic === "wholesale" ? "wholesale_b2b" : "retail_storefront")
    );
  } else {
    const stmt = db.prepare(`
      INSERT INTO contact_inquiries (
        reference_code, name, email, phone, topic, message, order_id, ip_hash, user_agent, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `);

    info = stmt.run(
      referenceCode,
      input.name.trim(),
      input.email.trim().toLowerCase(),
      input.phone && input.phone.trim().length > 0 ? input.phone.trim() : null,
      input.topic,
      input.message.trim(),
      input.order_id && input.order_id.trim().length > 0 ? input.order_id.trim() : null,
      meta?.ip_hash || null,
      meta?.user_agent ? meta.user_agent.slice(0, 255) : null
    );
  }

  const insertedId = Number(info.lastInsertRowid);
  const entityType = input.topic === "wholesale" ? "bulk_order" : "enquiry";
  const entityId = input.topic === "wholesale" ? `contact:${insertedId}` : String(insertedId);

  safeRecordEntityAttribution({
    entityType,
    entityId,
    attribution: attr,
    funnelName: attr?.funnelName || (input.topic === "wholesale" ? "wholesale_b2b" : "retail_storefront"),
    funnelStage: "form_submit",
    eventName: `contact_${input.topic}`,
    path: lastTouch?.landing_page || "/contact",
    customerName: input.name.trim(),
    customerEmail: input.email.trim().toLowerCase(),
    customerPhone: input.phone?.trim() || null,
    metadata: { referenceCode, topic: input.topic },
  });

  try {
    recordConversationEvent({
      sessionId: attr?.sessionId,
      channel: "contact_form",
      sourcePage: lastTouch?.landing_page || "/contact",
      referenceCode,
      customerName: input.name.trim(),
      customerEmail: input.email.trim().toLowerCase(),
      customerPhone: input.phone?.trim() || null,
      messagePreview: `[${input.topic}] ${input.message.trim().slice(0, 180)}`,
      linkedEntityType: entityType,
      linkedEntityId: entityId,
      attribution: attr,
    });
  } catch {}

  dispatchNotificationEvent({
    event: input.topic === "wholesale" ? "bulk_order" : "enquiry",
    source: "/api/contact",
    referenceId: referenceCode,
    summary: `${input.name.trim()} (${input.topic}) — ${input.email.trim().toLowerCase()}`,
    data: {
      id: insertedId,
      referenceCode,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      topic: input.topic,
      orderId: input.order_id?.trim() || null,
      message: input.message.trim(),
      attribution: buildCompactAttributionPayload(attr),
    },
  });

  return {
    id: insertedId,
    referenceCode,
    whatsappUrl,
  };
}

/**
 * Retrieves inquiries for administration and testing.
 */
export function getContactInquiries(options: { limit?: number; offset?: number } = {}): ContactInquiryRecord[] {
  const db = getDb();
  const limit = Math.max(1, Math.min(100, options.limit || 20));
  const offset = Math.max(0, options.offset || 0);

  const stmt = db.prepare(`
    SELECT id, reference_code, name, email, phone, topic, message, order_id, status, created_at
    FROM contact_inquiries
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `);

  return stmt.all(limit, offset) as ContactInquiryRecord[];
}
