import { getDb } from "@/lib/db";
import { getStoreSettings } from "@/lib/storeSettings";

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
export function recordWholesaleInquiry(inquiry: WholesaleInquiryInput): {
  id: number;
  whatsappUrl: string;
  whatsappNumber: string;
} {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO wholesale_inquiries (
      name, business_name, email, phone, interest, estimated_volume, location, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')
  `);

  const result = stmt.run(
    inquiry.name.trim(),
    inquiry.business_name.trim(),
    inquiry.email.trim().toLowerCase(),
    inquiry.phone.trim(),
    inquiry.interest.trim(),
    inquiry.estimated_volume.trim(),
    (inquiry.location || "").trim() || null,
    (inquiry.notes || "").trim() || null
  );

  const settings = getStoreSettings();
  const whatsappUrl = buildWhatsAppInquiryUrl({
    whatsappNumber: settings.whatsapp_number,
    inquiry,
  });

  return {
    id: Number(result.lastInsertRowid),
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
