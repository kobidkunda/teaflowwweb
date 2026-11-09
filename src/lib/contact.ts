import { getDb } from "@/lib/db";
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
  meta?: { ip_hash?: string; user_agent?: string }
): { id: number; referenceCode: string; whatsappUrl: string } {
  // Generate distinct human-readable reference ticket
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const referenceCode = `TF-CNT-${randomSuffix}`;

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

  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO contact_inquiries (
      reference_code, name, email, phone, topic, message, order_id, ip_hash, user_agent, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
  `);

  const info = stmt.run(
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

  return {
    id: Number(info.lastInsertRowid),
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
