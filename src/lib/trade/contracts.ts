import { z } from "zod";
import { attributionBundleSchema } from "@/lib/funnel/types";

export const TRADE_LOCALES = ["en", "bn", "hi", "gu", "mr", "pa", "ta", "te"] as const;
export const STAGED_TRADE_LOCALES = ["kn"] as const;
export const ALL_TRADE_LOCALES = [...TRADE_LOCALES, ...STAGED_TRADE_LOCALES] as const;

export type TradeLocale = (typeof TRADE_LOCALES)[number];
export type AnyTradeLocale = (typeof ALL_TRADE_LOCALES)[number];

export const PaymentMethodSchema = z.enum(["prepaid", "cod", "freight_advance"]);
export type TradePaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const IndianPinSchema = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit Indian PIN code.");

export const BulkQuoteLineSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(999),
});

export const BulkQuoteRequestSchema = z.object({
  channel: z.literal("trade"),
  quoteType: z.literal("bulk").optional().default("bulk"),
  locale: z.enum(ALL_TRADE_LOCALES),
  destinationPin: IndianPinSchema,
  lines: z.array(BulkQuoteLineSchema).min(1).max(20),
  payment: PaymentMethodSchema.default("prepaid"),
  trialOrderId: z.string().trim().min(4).max(120).optional(),
});
export type BulkQuoteRequest = z.infer<typeof BulkQuoteRequestSchema>;

export const TrialQuoteRequestSchema = z.object({
  channel: z.literal("trade"),
  quoteType: z.literal("trial"),
  locale: z.enum(ALL_TRADE_LOCALES),
  destinationPin: IndianPinSchema,
  trialId: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(10).default(1),
  payment: PaymentMethodSchema.default("prepaid"),
});
export type TrialQuoteRequest = z.infer<typeof TrialQuoteRequestSchema>;

export const QuoteRequestSchema = z.union([BulkQuoteRequestSchema, TrialQuoteRequestSchema]);
export type TradeQuoteRequest = z.infer<typeof QuoteRequestSchema>;

export type Handover =
  | { kind: "doorstep"; locality: string }
  | { kind: "depot"; name: string; address: string; onwardIncluded: boolean };

export type QuoteLineSnapshot = {
  variantId: number;
  productId: number;
  productName: string;
  sku: string;
  grams: number;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

export type QuoteResult =
  | {
      kind: "confirmed";
      id: string;
      quoteType: "bulk" | "trial";
      expiresAt: string;
      destinationPin: string;
      payment: TradePaymentMethod;
      serviceCode: string;
      serviceLabel: string;
      laneId: string;
      laneVersion: number;
      handover: Handover;
      lines: QuoteLineSnapshot[];
      netGrams: number;
      grossGrams: number;
      dimensionalGrams: number;
      billedGrams: number;
      maxNetGrams: number;
      capacityRatio: number;
      currency: "INR";
      goodsPaise: number;
      freightPaise: number;
      extraTaxPaise: number;
      otherFeesPaise: number;
      creditPaise: number;
      totalPaise: number;
      dueNowPaise: number;
      dueLaterPaise: number;
      etaLabel?: string;
    }
  | {
      kind: "manual";
      id: string;
      quoteType: "bulk" | "trial";
      destinationPin: string;
      reason: "unmapped_pin" | "overslab" | "unknown_charges" | "lane_paused";
      enquiryDraft: string;
      netGrams: number;
      billedGrams: number;
      maxNetGrams?: number;
    }
  | {
      kind: "unavailable";
      id: string;
      reason: string;
      alternatives: Array<"prepaid" | "pickup">;
    }
  | {
      kind: "temporarily_unavailable";
      retryable: true;
    };

export const TradeEnquiryRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  locale: z.enum(ALL_TRADE_LOCALES).default("en"),
  destinationPin: IndianPinSchema,
  enquiryType: z.enum(["bulk", "trial", "general"]).default("bulk"),
  lines: z
    .array(
      z.object({
        variantId: z.number().int().positive().optional(),
        label: z.string().trim().min(1).max(200),
        quantity: z.number().int().min(1).max(999),
      })
    )
    .max(20)
    .default([]),
  contactName: z.string().trim().max(120).optional().default(""),
  contactPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{8,20}$/, "Enter a valid phone or WhatsApp number."),
  preferredHours: z.string().trim().max(120).optional().default(""),
  consentGiven: z.literal(true),
  whatsappDraft: z.string().trim().max(1500).optional().default(""),
  ctaSource: z.string().trim().max(80).optional().default(""),
  attribution: attributionBundleSchema.optional(),
});

export const TradeCheckoutRequestSchema = z.object({
  quoteId: z.string().trim().min(8).max(120),
  idempotencyKey: z.string().trim().min(8).max(128),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{8,20}$/, "Enter a valid phone number."),
  customerEmail: z.string().trim().email().max(160).optional().or(z.literal("")).default(""),
  shippingAddress: z.string().trim().min(6).max(500),
  paymentMode: PaymentMethodSchema,
});

export const SharedInterestRequestSchema = z.object({
  pilotId: z.string().trim().min(1).max(120),
  contactName: z.string().trim().min(2).max(120),
  contactPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{8,20}$/, "Enter a valid phone number."),
  requestedKg: z.number().int().min(1).max(500),
  locale: z.enum(ALL_TRADE_LOCALES).default("en"),
});

export const ReorderReminderRequestSchema = z.object({
  orderId: z.string().trim().min(4).max(120),
  accessToken: z.string().trim().min(8).max(128),
  contactPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{8,20}$/, "Enter a valid phone number."),
  locale: z.enum(ALL_TRADE_LOCALES).default("en"),
  cadenceDays: z.number().int().min(7).max(90).default(15),
  optedIn: z.boolean().default(true),
});

// ---- Admin & MCP Mutation Schemas ----

export const TradeSettingsUpdateSchema = z.object({
  channel_enabled: z.boolean().optional(),
  enabled_locales: z.array(z.enum(ALL_TRADE_LOCALES)).min(1).optional(),
  staged_locales: z.array(z.enum(ALL_TRADE_LOCALES)).optional(),
  featured_trial_id: z.string().trim().max(120).nullable().optional(),
  trial_parcel_rate_paise: z.number().int().min(0).max(500000).optional(),
  trial_credit_paise: z.number().int().min(0).max(500000).optional(),
  trial_credit_min_qty_kg: z.number().int().min(1).max(500).optional(),
  trial_credit_expiry_days: z.number().int().min(1).max(365).optional(),
  whatsapp_number: z.string().trim().min(8).max(25).optional(),
  support_hours: z.string().trim().min(2).max(120).optional(),
  dispatch_cutoff_label: z.string().trim().min(2).max(200).optional(),
  hero_image_url: z.string().trim().min(1).max(500).optional(),
  hero_video_url: z.string().trim().max(500).nullable().optional(),
  hero_video_poster_url: z.string().trim().max(500).nullable().optional(),
  trial_image_url: z.string().trim().min(1).max(500).optional(),
});

export const TradeOfferUpsertSchema = z.object({
  product_id: z.number().int().positive(),
  featured_order: z.number().int().min(0).max(9999).default(0),
  eligible_variant_ids: z.array(z.number().int().positive()).default([]),
  default_variant_id: z.number().int().positive().nullable().optional(),
  starts_at: z.string().trim().nullable().optional(),
  ends_at: z.string().trim().nullable().optional(),
  published: z.boolean().default(true),
  badge_text: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const TradeLaneUpsertSchema = z.object({
  id: z.string().trim().min(2).max(120).optional(),
  lane_code: z.string().trim().min(2).max(80),
  version: z.number().int().min(1).optional(),
  is_active: z.boolean().default(true),
  origin_pin: IndianPinSchema.default("734015"),
  pin_start: IndianPinSchema,
  pin_end: IndianPinSchema,
  service_code: z.string().trim().min(2).max(60),
  service_label: z.string().trim().min(2).max(120),
  handover_kind: z.enum(["doorstep", "depot"]),
  locality_label: z.string().trim().max(160).default(""),
  depot_name: z.string().trim().max(160).nullable().optional(),
  depot_address: z.string().trim().max(300).nullable().optional(),
  onward_included: z.boolean().default(false),
  billed_weight_rule: z.enum(["gross", "max_gross_dim"]).default("max_gross_dim"),
  dim_divisor: z.number().int().min(1000).max(10000).default(5000),
  billing_increment_grams: z.number().int().min(100).max(10000).default(1000),
  tare_grams: z.number().int().min(0).max(10000).default(600),
  box_length_cm: z.number().int().min(1).max(300).default(40),
  box_width_cm: z.number().int().min(1).max(300).default(30),
  box_height_cm: z.number().int().min(1).max(300).default(30),
  max_net_grams: z.number().int().min(100).max(500000).default(30000),
  max_billed_grams: z.number().int().min(100).max(500000).default(30000),
  base_freight_paise: z.number().int().min(0).max(10000000).default(0),
  per_kg_freight_paise: z.number().int().min(0).max(1000000).default(0),
  last_mile_paise: z.number().int().min(0).max(1000000).default(0),
  extra_tax_bps: z.number().int().min(0).max(5000).default(0),
  other_fees_paise: z.number().int().min(0).max(1000000).default(0),
  cod_allowed: z.boolean().default(false),
  cod_fee_paise: z.number().int().min(0).max(1000000).default(0),
  cod_max_total_paise: z.number().int().min(0).nullable().optional(),
  freight_advance_allowed: z.boolean().default(false),
  eta_label: z.string().trim().min(1).max(120).default("2-4 business days"),
  operator_name: z.string().trim().max(120).nullable().optional(),
  starts_at: z.string().trim().nullable().optional(),
  ends_at: z.string().trim().nullable().optional(),
});

export const TradeLocalizedContentUpsertSchema = z.object({
  resource_key: z.string().trim().min(1).max(160),
  locale: z.enum(ALL_TRADE_LOCALES),
  source_revision: z.number().int().min(1).default(1),
  text_value: z.string().trim().min(1).max(5000),
  audio_url: z.string().trim().max(500).nullable().optional(),
  transcript: z.string().trim().max(5000).nullable().optional(),
  review_status: z.enum(["draft", "reviewed", "needs_review"]).default("reviewed"),
  updated_by: z.string().trim().max(120).nullable().optional(),
});

export const TradeEnquiryUpdateSchema = z.object({
  id: z.string().trim().min(2).max(120),
  status: z.enum(["new", "assigned", "quoted", "closed"]).optional(),
  assigned_owner: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  converted_quote_id: z.string().trim().max(120).nullable().optional(),
});

export const TradeSharedPilotUpsertSchema = z.object({
  id: z.string().trim().min(2).max(120).optional(),
  town_name: z.string().trim().min(2).max(120),
  pin_prefix: z.string().trim().min(3).max(6),
  collection_point: z.string().trim().min(2).max(160),
  collection_address: z.string().trim().min(4).max(300),
  local_fee_paise: z.number().int().min(0).max(500000).default(0),
  cutoff_at: z.string().trim().min(4).max(64),
  dispatch_partner: z.string().trim().min(2).max(120),
  dispatch_schedule: z.string().trim().min(2).max(160),
  target_kg: z.number().int().min(10).max(10000).default(200),
  booked_kg: z.number().int().min(0).max(10000).default(0),
  status: z.enum(["active", "paused", "dispatched", "cancelled"]).default("active"),
});

export const TradeOrderReconcileSchema = z.object({
  order_id: z.string().trim().min(4).max(120),
  remittance_status: z.enum(["none", "pending", "remitted"]).optional(),
  remitted_paise: z.number().int().min(0).optional(),
  dispatch_status: z.string().trim().max(60).optional(),
});
