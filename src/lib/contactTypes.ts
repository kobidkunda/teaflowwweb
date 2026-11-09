import { z } from "zod";

export const contactInquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name (at least 2 characters)")
    .max(100, "Name cannot exceed 100 characters"),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .max(100, "Email cannot exceed 100 characters"),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number cannot exceed 30 characters")
    .optional()
    .or(z.literal("")),
  topic: z.enum(
    [
      "brewing",
      "order",
      "cupping",
      "wholesale",
      "gardens",
      "general",
    ],
    {
      message: "Please choose a relevant inquiry topic",
    }
  ),
  order_id: z
    .string()
    .trim()
    .max(50, "Order reference cannot exceed 50 characters")
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Please provide more details (at least 10 characters)")
    .max(2000, "Message cannot exceed 2,000 characters"),
  honeypot: z.string().optional().or(z.literal("")),
});

export type ContactInquiryInput = z.infer<typeof contactInquirySchema>;

export interface ContactInquiryRecord {
  id: number;
  reference_code: string;
  name: string;
  email: string;
  phone: string | null;
  topic: string;
  message: string;
  order_id: string | null;
  status: string;
  created_at: string;
}

export const TOPIC_LABELS: Record<ContactInquiryInput["topic"], string> = {
  brewing: "🍃 Brewing & Steeping Guidance",
  order: "📦 Order Status & Delivery",
  cupping: "🫖 Private Tasting Room Booking",
  wholesale: "🌿 Wholesale & Corporate Gifting",
  gardens: "🤝 Garden & Estate Partnerships",
  general: "💬 General Inquiry",
};

/**
 * Strips formatting characters to produce a clean numerical string for WhatsApp click-to-chat.
 */
export function cleanWhatsAppNumber(input = "917001304853"): string {
  const digits = input.replace(/\D/g, "");
  return digits || "917001304853";
}

/**
 * Builds an authentic, formatted WhatsApp click-to-chat URL.
 */
export function buildContactWhatsAppUrl(data: {
  name: string;
  topic: string;
  message: string;
  orderId?: string | null;
  referenceCode?: string;
  phoneTarget?: string;
}): string {
  const targetNumber = cleanWhatsAppNumber(data.phoneTarget || "917001304853");
  const topicLabel = TOPIC_LABELS[data.topic as ContactInquiryInput["topic"]] || data.topic;

  const lines = [
    "🍵 *TEAFLOWW — SENSORY & ORDER INQUIRY*",
    "",
    `*Sender:* ${data.name}`,
    `*Topic:* ${topicLabel}`,
    data.orderId ? `*Order Reference:* #${data.orderId}` : null,
    data.referenceCode ? `*Ticket Ref:* ${data.referenceCode}` : null,
    "",
    `*Note / Query:*`,
    data.message,
    "",
    "_Direct message sent from TeaFloww.com contact hub._",
  ].filter(Boolean);

  return `https://wa.me/${targetNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
}
