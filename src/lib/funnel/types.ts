import { z } from "zod";

export const FUNNEL_STAGES = [
  "visit",
  "product_view",
  "add_to_cart",
  "lead_capture",
  "form_submit",
  "conversation",
  "cart_abandoned",
  "checkout_start",
  "payment_info",
  "order_placed",
  "order_paid",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const FUNNEL_STAGE_RANK: Record<FunnelStage, number> = {
  visit: 1,
  product_view: 2,
  add_to_cart: 3,
  lead_capture: 4,
  form_submit: 5,
  conversation: 6,
  cart_abandoned: 7,
  checkout_start: 8,
  payment_info: 9,
  order_placed: 10,
  order_paid: 11,
};

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  visit: "Store Visit",
  product_view: "Product View",
  add_to_cart: "Add to Cart",
  lead_capture: "Lead Captured",
  form_submit: "Form Submit",
  conversation: "Conversation",
  cart_abandoned: "Cart Abandoned",
  checkout_start: "Checkout Start",
  payment_info: "Payment Info",
  order_placed: "Order Placed",
  order_paid: "Order Paid",
};

export const FUNNEL_NAMES = [
  "retail_storefront",
  "trials",
  "wholesale_b2b",
  "private_label",
  "blend_lab",
  "subscriptions",
  "newsletter",
  "editorial_blog",
] as const;

export type FunnelName = (typeof FUNNEL_NAMES)[number];

export const FUNNEL_LABELS: Record<FunnelName, string> = {
  retail_storefront: "Retail Storefront",
  trials: "Home Tea Trials",
  wholesale_b2b: "Wholesale B2B",
  private_label: "Private Label Studio",
  blend_lab: "Blend Lab",
  subscriptions: "Tea Subscriptions",
  newsletter: "Newsletter",
  editorial_blog: "Journal & Content",
};

export const CONVERSATION_CHANNELS = [
  "whatsapp_floating",
  "whatsapp_checkout_help",
  "whatsapp_cart_recovery",
  "whatsapp_wholesale",
  "whatsapp_private_label",
  "whatsapp_contact",
  "whatsapp_order",
  "phone_call",
  "contact_form",
  "wholesale_form",
  "admin_inbox_reply",
  "customer_feedback",
] as const;

export type ConversationChannel = (typeof CONVERSATION_CHANNELS)[number];

export function sanitizeAttrStr(value: unknown, maxLen = 200): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

export const attributionTouchSchema = z.object({
  utm_source: z.string().trim().max(200).optional().default(""),
  utm_medium: z.string().trim().max(200).optional().default(""),
  utm_campaign: z.string().trim().max(200).optional().default(""),
  utm_term: z.string().trim().max(300).optional().default(""),
  utm_content: z.string().trim().max(200).optional().default(""),
  utm_id: z.string().trim().max(200).optional().default(""),
  gclid: z.string().trim().max(200).optional().default(""),
  dclid: z.string().trim().max(200).optional().default(""),
  gbraid: z.string().trim().max(200).optional().default(""),
  wbraid: z.string().trim().max(200).optional().default(""),
  fbclid: z.string().trim().max(200).optional().default(""),
  ttclid: z.string().trim().max(200).optional().default(""),
  msclkid: z.string().trim().max(200).optional().default(""),
  referrer: z.string().trim().max(500).optional().default(""),
  landing_page: z.string().trim().max(500).optional().default(""),
  captured_at: z.string().trim().max(64).optional().default(""),
});

export type AttributionTouch = z.infer<typeof attributionTouchSchema>;

export const EMPTY_ATTRIBUTION_TOUCH: AttributionTouch = {
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
  utm_id: "",
  gclid: "",
  dclid: "",
  gbraid: "",
  wbraid: "",
  fbclid: "",
  ttclid: "",
  msclkid: "",
  referrer: "",
  landing_page: "",
  captured_at: "",
};

export const attributionBundleSchema = z.object({
  sessionId: z.string().trim().max(128).optional().default(""),
  firstTouch: attributionTouchSchema.optional(),
  lastTouch: attributionTouchSchema.optional(),
  fbc: z.string().trim().max(300).optional(),
  fbp: z.string().trim().max(300).optional(),
  funnelName: z.enum(FUNNEL_NAMES).optional(),
  marketingConsent: z.boolean().optional(),
  analyticsConsent: z.boolean().optional(),
});

export type AttributionBundle = z.infer<typeof attributionBundleSchema>;

export const funnelTrackEventSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  eventId: z.string().trim().max(128).optional(),
  funnelName: z.enum(FUNNEL_NAMES).optional(),
  funnelStage: z.enum(FUNNEL_STAGES),
  eventName: z.string().trim().min(1).max(80),
  path: z.string().trim().min(1).max(500).default("/"),
  valuePaise: z.number().int().min(0).max(100_000_000_00).optional().default(0),
  currency: z.string().trim().max(10).optional().default("INR"),
  entityType: z.string().trim().max(64).optional(),
  entityId: z.string().trim().max(128).optional(),
  attribution: attributionBundleSchema.optional(),
  conversation: z
    .object({
      channel: z.enum(CONVERSATION_CHANNELS),
      sourcePage: z.string().trim().max(500).optional(),
      referenceCode: z.string().trim().max(120).optional(),
      customerName: z.string().trim().max(120).optional(),
      customerEmail: z.string().trim().max(254).optional(),
      customerPhone: z.string().trim().max(40).optional(),
      messagePreview: z.string().trim().max(500).optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export type FunnelTrackEventInput = z.infer<typeof funnelTrackEventSchema>;

export function resolveFunnelNameFromPath(pathname: string): FunnelName {
  const clean = (pathname || "/").split("?")[0].toLowerCase();
  if (clean.startsWith("/trials")) return "trials";
  if (clean.startsWith("/wholesale")) return "wholesale_b2b";
  if (clean.startsWith("/private-label")) return "private_label";
  if (clean.startsWith("/blend-lab")) return "blend_lab";
  if (clean.startsWith("/subscriptions")) return "subscriptions";
  if (clean.startsWith("/blog")) return "editorial_blog";
  return "retail_storefront";
}

export function hasCampaignOrClickSignals(touch?: Partial<AttributionTouch> | null): boolean {
  if (!touch) return false;
  return Boolean(
    touch.utm_source ||
      touch.utm_medium ||
      touch.utm_campaign ||
      touch.utm_term ||
      touch.utm_content ||
      touch.utm_id ||
      touch.gclid ||
      touch.dclid ||
      touch.gbraid ||
      touch.wbraid ||
      touch.fbclid ||
      touch.ttclid ||
      touch.msclkid
  );
}

/** Infer default source/medium from click IDs or referrer when UTMs are omitted. */
export function normalizeTouchWithClickInference(
  touch: Partial<AttributionTouch>
): AttributionTouch {
  const normalized: AttributionTouch = {
    utm_source: sanitizeAttrStr(touch.utm_source, 200),
    utm_medium: sanitizeAttrStr(touch.utm_medium, 200),
    utm_campaign: sanitizeAttrStr(touch.utm_campaign, 200),
    utm_term: sanitizeAttrStr(touch.utm_term, 300),
    utm_content: sanitizeAttrStr(touch.utm_content, 200),
    utm_id: sanitizeAttrStr(touch.utm_id, 200),
    gclid: sanitizeAttrStr(touch.gclid, 200),
    dclid: sanitizeAttrStr(touch.dclid, 200),
    gbraid: sanitizeAttrStr(touch.gbraid, 200),
    wbraid: sanitizeAttrStr(touch.wbraid, 200),
    fbclid: sanitizeAttrStr(touch.fbclid, 200),
    ttclid: sanitizeAttrStr(touch.ttclid, 200),
    msclkid: sanitizeAttrStr(touch.msclkid, 200),
    referrer: sanitizeAttrStr(touch.referrer, 500),
    landing_page: sanitizeAttrStr(touch.landing_page, 500),
    captured_at: sanitizeAttrStr(touch.captured_at, 64),
  };

  if (!normalized.utm_source) {
    if (normalized.gclid || normalized.gbraid || normalized.wbraid || normalized.dclid) {
      normalized.utm_source = "google";
      normalized.utm_medium ||= "cpc";
    } else if (normalized.fbclid) {
      normalized.utm_source = "meta";
      normalized.utm_medium ||= "paid_social";
    } else if (normalized.ttclid) {
      normalized.utm_source = "tiktok";
      normalized.utm_medium ||= "paid_social";
    } else if (normalized.msclkid) {
      normalized.utm_source = "bing";
      normalized.utm_medium ||= "cpc";
    } else if (normalized.referrer) {
      try {
        const refHost = new URL(normalized.referrer).hostname.replace(/^www\./, "").toLowerCase();
        if (refHost && !refHost.includes("teafloww")) {
          if (refHost.includes("google.")) {
            normalized.utm_source = "google";
            normalized.utm_medium ||= "organic";
          } else if (refHost.includes("bing.com")) {
            normalized.utm_source = "bing";
            normalized.utm_medium ||= "organic";
          } else if (refHost.includes("facebook.com") || refHost.includes("fb.com") || refHost.includes("instagram.com")) {
            normalized.utm_source = refHost.includes("instagram") ? "instagram" : "facebook";
            normalized.utm_medium ||= "social";
          } else {
            normalized.utm_source = refHost.slice(0, 100);
            normalized.utm_medium ||= "referral";
          }
        }
      } catch {
        // Ignore malformed referrer URLs
      }
    }
  }

  return normalized;
}
