import { getDb } from "@/lib/db";
import { getStoreSettings } from "@/lib/storeSettings";
import { dispatchNotificationEvent } from "@/lib/notifications/dispatch";
import {
  buildCompactAttributionPayload,
  getTableColumns,
  recordConversationEvent,
  safeRecordEntityAttribution,
  type ExtractedRequestAttribution,
} from "@/lib/funnel/server";

export interface WholesaleInquiry {
  id?: number;
  name: string;
  business_name: string;
  email: string;
  phone: string;
  interest: string;
  estimated_volume: string;
  location?: string | null;
  notes?: string | null;
  status?: string;
  created_at?: string;
}

export interface WholesaleInquiryInput {
  name: string;
  business_name: string;
  email: string;
  phone: string;
  interest: string;
  estimated_volume: string;
  location?: string;
  notes?: string;
}

/**
 * Strips formatting characters to produce a clean E.164-compatible numerical string for WhatsApp API.
 */
export function cleanWhatsAppNumber(input: string): string {
  const digits = input.replace(/\D/g, "");
  // Default to 919832012345 if empty
  return digits || "919832012345";
}

/**
 * Formats a professional B2B inquiry message and builds the WhatsApp click-to-chat URL.
 */
export function buildWhatsAppInquiryUrl(params: {
  whatsappNumber: string;
  inquiry: WholesaleInquiryInput;
}): string {
  const cleanNumber = cleanWhatsAppNumber(params.whatsappNumber);
  const msg = [
    "🍵 *HIMALAYAN TEA HOUSE — WHOLESALE / BULK INQUIRY*",
    "",
    `*Contact Person:* ${params.inquiry.name}`,
    `*Business / Cafe:* ${params.inquiry.business_name}`,
    `*Email:* ${params.inquiry.email}`,
    `*Phone:* ${params.inquiry.phone}`,
    `*Tea Category / Interest:* ${params.inquiry.interest}`,
    `*Estimated Batch Volume:* ${params.inquiry.estimated_volume}`,
    params.inquiry.location ? `*Delivery Destination:* ${params.inquiry.location}` : null,
    params.inquiry.notes ? `*Requirements & Notes:* ${params.inquiry.notes}` : null,
    "",
    "_Direct inquiry from Himalayan Tea House wholesale portal._",
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`;
}

/**
 * Parameterized database insert that persists the lead safely before redirecting to WhatsApp.
 */
export function recordWholesaleInquiry(
  inquiry: WholesaleInquiryInput,
  attribution?: ExtractedRequestAttribution
): {
  id: number;
  whatsappUrl: string;
  whatsappNumber: string;
} {
  const db = getDb();
  const lastTouch = attribution?.lastTouch || attribution?.firstTouch;
  const cols = getTableColumns(db, "wholesale_inquiries");

  let result: { lastInsertRowid: number | bigint };
  if (cols.has("utm_source")) {
    const stmt = db.prepare(`
      INSERT INTO wholesale_inquiries (
        name, business_name, email, phone, interest, estimated_volume, location, notes, status,
        session_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, landing_page, funnel_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    result = stmt.run(
      inquiry.name.trim(),
      inquiry.business_name.trim(),
      inquiry.email.trim().toLowerCase(),
      inquiry.phone.trim(),
      inquiry.interest.trim(),
      inquiry.estimated_volume.trim(),
      (inquiry.location || "").trim() || null,
      (inquiry.notes || "").trim() || null,
      attribution?.sessionId || null,
      lastTouch?.utm_source || "",
      lastTouch?.utm_medium || "",
      lastTouch?.utm_campaign || "",
      lastTouch?.utm_term || "",
      lastTouch?.utm_content || "",
      lastTouch?.gclid || "",
      lastTouch?.fbclid || "",
      lastTouch?.landing_page || "",
      attribution?.funnelName || "wholesale_b2b"
    );
  } else {
    const stmt = db.prepare(`
      INSERT INTO wholesale_inquiries (
        name, business_name, email, phone, interest, estimated_volume, location, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `);

    result = stmt.run(
      inquiry.name.trim(),
      inquiry.business_name.trim(),
      inquiry.email.trim().toLowerCase(),
      inquiry.phone.trim(),
      inquiry.interest.trim(),
      inquiry.estimated_volume.trim(),
      (inquiry.location || "").trim() || null,
      (inquiry.notes || "").trim() || null
    );
  }

  const settings = getStoreSettings();
  const whatsappUrl = buildWhatsAppInquiryUrl({
    whatsappNumber: settings.whatsapp_number,
    inquiry,
  });

  const insertedId = Number(result.lastInsertRowid);
  const entityId = `wholesale:${insertedId}`;

  safeRecordEntityAttribution({
    entityType: "bulk_order",
    entityId,
    attribution,
    funnelName: attribution?.funnelName || "wholesale_b2b",
    funnelStage: "form_submit",
    eventName: "wholesale_inquiry",
    path: lastTouch?.landing_page || "/wholesale",
    customerName: inquiry.name.trim(),
    customerEmail: inquiry.email.trim().toLowerCase(),
    customerPhone: inquiry.phone.trim(),
    metadata: {
      businessName: inquiry.business_name.trim(),
      interest: inquiry.interest.trim(),
      estimatedVolume: inquiry.estimated_volume.trim(),
    },
  });

  try {
    recordConversationEvent({
      sessionId: attribution?.sessionId,
      channel: "wholesale_form",
      sourcePage: lastTouch?.landing_page || "/wholesale",
      referenceCode: `WHOLESALE-${insertedId}`,
      customerName: inquiry.name.trim(),
      customerEmail: inquiry.email.trim().toLowerCase(),
      customerPhone: inquiry.phone.trim(),
      messagePreview: `${inquiry.business_name.trim()} — ${inquiry.interest.trim()} (${inquiry.estimated_volume.trim()})`,
      linkedEntityType: "bulk_order",
      linkedEntityId: entityId,
      attribution,
    });
  } catch {}

  dispatchNotificationEvent({
    event: "bulk_order",
    source: "/api/wholesale",
    referenceId: `WHOLESALE-${insertedId}`,
    summary: `${inquiry.business_name.trim()} (${inquiry.estimated_volume.trim()}) — ${inquiry.name.trim()}`,
    data: {
      id: insertedId,
      name: inquiry.name.trim(),
      businessName: inquiry.business_name.trim(),
      email: inquiry.email.trim().toLowerCase(),
      phone: inquiry.phone.trim(),
      interest: inquiry.interest.trim(),
      estimatedVolume: inquiry.estimated_volume.trim(),
      location: (inquiry.location || "").trim() || null,
      notes: (inquiry.notes || "").trim() || null,
      attribution: buildCompactAttributionPayload(attribution),
    },
  });

  return {
    id: insertedId,
    whatsappUrl,
    whatsappNumber: settings.whatsapp_number,
  };
}

/**
 * Retrieves recent wholesale inquiries for admin review.
 */
export function getWholesaleInquiries(limit = 50): WholesaleInquiry[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM wholesale_inquiries ORDER BY created_at DESC LIMIT ?")
    .all(limit) as WholesaleInquiry[];
}
