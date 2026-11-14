import { createHmac } from "node:crypto";
import { z } from "zod";

export const NOTIFICATION_EVENT_TYPES = [
  "enquiry",
  "bulk_order",
  "lead_modal",
  "newsletter",
  "private_label",
  "quote",
  "order",
  "subscription",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export const EVENT_LABELS: Record<NotificationEventType, string> = {
  enquiry: "Contact & General Enquiry",
  bulk_order: "Bulk Order & Wholesale Enquiry",
  lead_modal: "Lead Capture Modal",
  newsletter: "Newsletter Signup",
  private_label: "Private Label & Blend Lab",
  quote: "Checkout / Shipping Quote",
  order: "Order Placed / Confirmed",
  subscription: "Tea Subscription Event",
};

export const EVENT_WEBHOOK_SETTING_KEYS = {
  enquiry: "webhook_url_enquiry",
  bulk_order: "webhook_url_bulk_order",
  lead_modal: "webhook_url_lead_modal",
  newsletter: "webhook_url_newsletter",
  private_label: "webhook_url_private_label",
  quote: "webhook_url_quote",
  order: "webhook_url_order",
  subscription: "webhook_url_subscription",
} as const satisfies Record<NotificationEventType, string>;

export interface NotificationEnvelope {
  id: string;
  event: NotificationEventType;
  occurredAt: string;
  source: string;
  summary: string;
  referenceId?: string;
  data: Record<string, unknown>;
}

const emailValidator = z.string().email();

export function parseNotificationEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim().toLowerCase();
    if (!trimmed || seen.has(trimmed)) continue;
    if (emailValidator.safeParse(trimmed).success) {
      seen.add(trimmed);
      valid.push(trimmed);
    }
  }
  return valid;
}

export function isValidWebhookUrl(raw: string | null | undefined): boolean {
  if (!raw || !raw.trim()) return false;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function signWebhookPayload(secret: string, body: string): string {
  const digest = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return `sha256=${digest}`;
}
