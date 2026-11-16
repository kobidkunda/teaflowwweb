import { z } from "zod";

export const SEGMENTS = ["starter", "trader"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const LOCALES = ["en", "hi"] as const;
export type BusinessLocale = (typeof LOCALES)[number];

export const OFFER_CODES = ["bulk_supply", "ready_retail", "private_label"] as const;
export type OfferCode = (typeof OFFER_CODES)[number];

export const INTEREST_OPTIONS = ["bulk_supply", "ready_retail", "private_label", "unsure"] as const;
export type BusinessInterest = (typeof INTEREST_OPTIONS)[number];

export const QUANTITY_BANDS = ["25-49", "50-99", "100-249", "250-plus", "unsure"] as const;
export type QuantityBand = (typeof QUANTITY_BANDS)[number];

export const LEAD_STATUSES = [
  "new",
  "contact_attempted",
  "qualified",
  "disqualified",
  "quote_sent",
  "won",
  "lost",
] as const;
export type BusinessLeadStatus = (typeof LEAD_STATUSES)[number];

export const DISQUALIFICATION_REASONS = [
  "no_buying_intent",
  "unserviceable_destination",
  "below_confirmed_moq",
  "wrong_product",
  "invalid_contact",
  "duplicate_existing",
  "not_ready",
] as const;
export type DisqualificationReason = (typeof DISQUALIFICATION_REASONS)[number];

export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}

export const attributionSchema = z
  .object({
    utm_source: z.string().trim().max(100).optional(),
    utm_medium: z.string().trim().max(100).optional(),
    utm_campaign: z.string().trim().max(150).optional(),
    utm_content: z.string().trim().max(150).optional(),
    utm_term: z.string().trim().max(150).optional(),
    gclid: z.string().trim().max(250).optional(),
    gbraid: z.string().trim().max(250).optional(),
    wbraid: z.string().trim().max(250).optional(),
    fbclid: z.string().trim().max(250).optional(),
  })
  .strict()
  .default({});

export const businessLeadSchema = z
  .object({
    segment: z.enum(SEGMENTS),
    interest: z.enum(INTEREST_OPTIONS),
    quantityBand: z.enum(QUANTITY_BANDS),
    pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit Indian pincode"),
    name: z.string().trim().min(2, "Enter your name (at least 2 characters)").max(90),
    phone: z
      .string()
      .trim()
      .transform(normalizeIndianPhone)
      .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")),
    contactConsent: z.literal(true, {
      message: "Consent is required so TeaFloww can contact you about this quotation",
    }),
    marketingConsent: z.boolean().default(false),
    company: z.string().trim().max(100).optional(),
    note: z.string().trim().max(500).optional(),
    locale: z.enum(LOCALES).default("en"),
    attribution: attributionSchema,
    honeypot: z.string().max(120).optional(),
  })
  .strict();

export type BusinessLeadInput = z.infer<typeof businessLeadSchema>;

export const b2bSettingsSchema = z.object({
  business_landing_enabled: z.boolean().optional(),
  leads_enabled: z.boolean().optional(),
  whatsapp_enabled: z.boolean().optional(),
  whatsapp_e164: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "WhatsApp number must be 10-15 digits without +")
    .nullable()
    .optional(),
  support_hours: z.string().trim().min(3).max(120).optional(),
  starter_hero_image_url: z.string().trim().min(1).max(400).optional(),
  trader_hero_image_url: z.string().trim().min(1).max(400).optional(),
  proof_image_1_url: z.string().trim().min(1).max(400).optional(),
  proof_image_2_url: z.string().trim().min(1).max(400).optional(),
  crm_webhook_enabled: z.boolean().optional(),
});

export const b2bOfferUpsertSchema = z.object({
  code: z.enum(OFFER_CODES),
  eyebrow_en: z.string().trim().min(1).max(80),
  eyebrow_hi: z.string().trim().min(1).max(80),
  title_en: z.string().trim().min(2).max(120),
  title_hi: z.string().trim().min(2).max(120),
  description_en: z.string().trim().min(5).max(500),
  description_hi: z.string().trim().min(5).max(500),
  cta_label_en: z.string().trim().min(2).max(60),
  cta_label_hi: z.string().trim().min(2).max(60),
  icon: z.enum(["package", "shopping-bag", "pen-tool"]).default("package"),
  image_url: z.string().trim().max(400).nullable().optional(),
  image_alt_en: z.string().trim().max(240).nullable().optional(),
  image_alt_hi: z.string().trim().max(240).nullable().optional(),
  sku_ids: z.array(z.string().trim().min(1)).default([]),
  moq_text_en: z.string().trim().max(240).nullable().optional(),
  moq_text_hi: z.string().trim().max(240).nullable().optional(),
  pricing_mode: z.enum(["request_quote", "approved_display_price"]).default("request_quote"),
  service_scope: z.array(z.string().trim().min(1).max(120)).default([]),
  active: z.boolean().default(true),
  approve: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(100).default(0),
});

export const b2bStepSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(300),
});

export const b2bFaqSchema = z.object({
  q: z.string().trim().min(2).max(240),
  a: z.string().trim().min(2).max(800),
});

export const b2bProofItemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  caption: z.string().trim().min(1).max(300),
  imageUrl: z.string().trim().min(1).max(400),
  alt: z.string().trim().min(1).max(240),
  sourceOwner: z.string().trim().min(1).max(120),
  approvedAt: z.string().trim().nullable().optional(),
});

export const b2bPageContentUpsertSchema = z.object({
  segment: z.enum(SEGMENTS),
  locale: z.enum(LOCALES),
  eyebrow: z.string().trim().min(1).max(100),
  headline: z.string().trim().min(2).max(180),
  intro: z.string().trim().min(5).max(500),
  primary_cta: z.string().trim().min(2).max(80),
  secondary_cta: z.string().trim().min(2).max(80),
  hero_image_url: z.string().trim().min(1).max(400),
  hero_image_alt: z.string().trim().min(2).max(240),
  process_intro: z.string().trim().min(2).max(300),
  steps: z.array(b2bStepSchema).min(1).max(8),
  proof_title: z.string().trim().min(2).max(180),
  proof_body: z.string().trim().min(5).max(500),
  proof_items: z.array(b2bProofItemSchema).max(6).default([]),
  form_heading: z.string().trim().min(2).max(160),
  form_subhead: z.string().trim().min(5).max(360),
  faq: z.array(b2bFaqSchema).min(1).max(20),
  seo_title: z.string().trim().min(2).max(120),
  seo_description: z.string().trim().min(10).max(240),
  approve: z.boolean().optional(),
});

export const b2bClaimUpsertSchema = z.object({
  claim_key: z.string().trim().regex(/^[a-z0-9_]+$/).min(2).max(80),
  exact_copy_en: z.string().trim().min(2).max(500),
  exact_copy_hi: z.string().trim().min(2).max(500),
  evidence_source: z.string().trim().min(2).max(240),
  evidence_owner: z.string().trim().min(2).max(120),
  allowed_channels: z.array(z.enum(["web", "meta", "google", "sales"])).min(1),
  active: z.boolean().default(true),
  approve: z.boolean().optional(),
  valid_until: z.string().trim().nullable().optional(),
});

export const b2bLeadTransitionSchema = z.object({
  status: z.enum(LEAD_STATUSES),
  qualification_reason: z.string().trim().max(120).nullable().optional(),
  owner_id: z.string().trim().max(120).nullable().optional(),
  quoted_amount_paise: z.number().int().min(0).nullable().optional(),
  first_order_id: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(500).optional(),
  request_deletion: z.boolean().optional(),
});

export const b2bQuoteCreateSchema = z.object({
  lead_id: z.string().trim().min(1),
  line_items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(240),
        format: z.string().trim().min(1).max(100),
        quantity_label: z.string().trim().min(1).max(80),
        unit_price_paise: z.number().int().min(0),
        line_total_paise: z.number().int().min(0),
      })
    )
    .min(1),
  freight_paise: z.number().int().min(0).default(0),
  tax_paise: z.number().int().min(0).default(0),
  freight_terms: z.string().trim().min(2).max(240),
  valid_until: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  mark_sent: z.boolean().default(true),
});
