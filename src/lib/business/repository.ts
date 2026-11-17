import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import {
  b2bClaimUpsertSchema,
  b2bLeadTransitionSchema,
  b2bOfferUpsertSchema,
  b2bPageContentUpsertSchema,
  b2bQuoteCreateSchema,
  b2bSettingsSchema,
  type BusinessLeadInput,
  type BusinessLeadStatus,
  type BusinessLocale,
  type OfferCode,
  type Segment,
} from "./schema";

export class IdempotencyConflictError extends Error {
  constructor(message = "Idempotency-Key reused with a different request payload.") {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export class LeadTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadTransitionError";
  }
}

export class BusinessNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessNotFoundError";
  }
}

export type B2BSettings = {
  id: string;
  business_landing_enabled: boolean;
  leads_enabled: boolean;
  whatsapp_enabled: boolean;
  whatsapp_e164: string | null;
  support_hours: string;
  starter_hero_image_url: string;
  trader_hero_image_url: string;
  proof_image_1_url: string;
  proof_image_2_url: string;
  crm_webhook_enabled: boolean;
  updated_at: string;
};

export type B2BOfferRecord = {
  id: string;
  code: OfferCode;
  eyebrow_en: string;
  eyebrow_hi: string;
  title_en: string;
  title_hi: string;
  description_en: string;
  description_hi: string;
  cta_label_en: string;
  cta_label_hi: string;
  icon: "package" | "shopping-bag" | "pen-tool";
  image_url: string | null;
  image_alt_en: string | null;
  image_alt_hi: string | null;
  sku_ids: string[];
  moq_text_en: string | null;
  moq_text_hi: string | null;
  pricing_mode: "request_quote" | "approved_display_price";
  service_scope: string[];
  active: boolean;
  approved_at: string | null;
  approved_by: string | null;
  sort_order: number;
  updated_at: string;
};

export type PublicOfferView = {
  id: string;
  code: OfferCode;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  icon: "package" | "shopping-bag" | "pen-tool";
  imageUrl: string | null;
  imageAlt: string | null;
  skuIds: string[];
  moqText: string | null;
  pricingMode: "request_quote" | "approved_display_price";
  serviceScope: string[];
  approvedAt: string;
};

export type B2BPageStep = { title: string; body: string };
export type B2BFaqItem = { q: string; a: string };
export type B2BProofItem = {
  title: string;
  caption: string;
  imageUrl: string;
  alt: string;
  sourceOwner: string;
  approvedAt?: string | null;
};

export type B2BPageContentRecord = {
  id: string;
  segment: Segment;
  locale: BusinessLocale;
  eyebrow: string;
  headline: string;
  intro: string;
  primary_cta: string;
  secondary_cta: string;
  hero_image_url: string;
  hero_image_alt: string;
  process_intro: string;
  steps: B2BPageStep[];
  proof_title: string;
  proof_body: string;
  proof_items: B2BProofItem[];
  form_heading: string;
  form_subhead: string;
  faq: B2BFaqItem[];
  seo_title: string;
  seo_description: string;
  approved_at: string | null;
  updated_at: string;
};

export type B2BClaimRecord = {
  claim_key: string;
  exact_copy_en: string;
  exact_copy_hi: string;
  evidence_source: string;
  evidence_owner: string;
  allowed_channels: Array<"web" | "meta" | "google" | "sales">;
  active: boolean;
  approved_at: string | null;
  valid_until: string | null;
  updated_at: string;
};

export type B2BLeadRecord = {
  id: string;
  reference: string;
  segment: Segment;
  interest: BusinessLeadInput["interest"];
  quantity_band: BusinessLeadInput["quantityBand"];
  pincode: string;
  name: string;
  phone: string;
  company: string | null;
  note: string | null;
  locale: BusinessLeadInput["locale"];
  status: BusinessLeadStatus;
  qualification_reason: string | null;
  owner_id: string | null;
  contact_consent_at: string;
  marketing_consent_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  fbclid: string | null;
  first_contact_at: string | null;
  qualified_at: string | null;
  quoted_at: string | null;
  won_at: string | null;
  lost_at: string | null;
  quoted_amount_paise: number | null;
  first_order_id: string | null;
  deletion_requested_at: string | null;
  created_at: string;
  updated_at: string;
};

export type B2BLeadEventRecord = {
  id: string;
  lead_id: string;
  type: string;
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
  external_key: string | null;
  event_time: string;
};

export type B2BQuoteRecord = {
  id: string;
  lead_id: string;
  quote_number: string;
  version: number;
  line_items: Array<{
    description: string;
    format: string;
    quantity_label: string;
    unit_price_paise: number;
    line_total_paise: number;
  }>;
  freight_paise: number;
  tax_paise: number;
  total_paise: number;
  freight_terms: string;
  valid_until: string | null;
  notes: string | null;
  status: "draft" | "sent" | "accepted" | "expired" | "cancelled";
  created_by: string | null;
  created_at: string;
};

export type B2BOutboxRecord = {
  id: string;
  topic: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  attempt: number;
  status: "pending" | "processing" | "done" | "dead_letter";
  last_error: string | null;
  dedupe_key: string;
  created_at: string;
  processed_at: string | null;
};

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function computeLeadFingerprint(input: BusinessLeadInput): string {
  const canonical = {
    segment: input.segment,
    interest: input.interest,
    quantityBand: input.quantityBand,
    pincode: input.pincode,
    name: input.name.trim(),
    phone: input.phone.trim(),
    company: input.company?.trim() ?? null,
    note: input.note?.trim() ?? null,
    locale: input.locale,
    contactConsent: input.contactConsent,
    marketingConsent: input.marketingConsent,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function generateLeadReference(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randPart = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `TFB-${datePart}-${randPart}`;
}

export function getB2BSettings(): B2BSettings {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM b2b_settings WHERE id = ?")
    .get("default") as Record<string, unknown> | undefined;

  if (!row) {
    return {
      id: "default",
      business_landing_enabled: true,
      leads_enabled: true,
      whatsapp_enabled: true,
      whatsapp_e164: "917001304853",
      support_hours: "Mon-Sat 9:00 AM - 7:00 PM IST",
      starter_hero_image_url: "/images/hero-himalayan-tea.webp",
      trader_hero_image_url: "/images/cupping-guide.webp",
      proof_image_1_url: "/images/orthodox-vs-ctc.webp",
      proof_image_2_url: "/images/private-label/teafloww-reserve-front-v2.webp",
      crm_webhook_enabled: false,
      updated_at: new Date().toISOString(),
    };
  }

  return {
    id: String(row.id),
    business_landing_enabled: Number(row.business_landing_enabled) === 1,
    leads_enabled: Number(row.leads_enabled) === 1,
    whatsapp_enabled: Number(row.whatsapp_enabled) === 1,
    whatsapp_e164: row.whatsapp_e164 ? String(row.whatsapp_e164) : null,
    support_hours: String(row.support_hours),
    starter_hero_image_url: String(row.starter_hero_image_url),
    trader_hero_image_url: String(row.trader_hero_image_url),
    proof_image_1_url: String(row.proof_image_1_url),
    proof_image_2_url: String(row.proof_image_2_url),
    crm_webhook_enabled: Number(row.crm_webhook_enabled) === 1,
    updated_at: String(row.updated_at),
  };
}

export function updateB2BSettings(input: unknown): B2BSettings {
  const parsed = b2bSettingsSchema.parse(input);
  const current = getB2BSettings();
  const next = {
    business_landing_enabled:
      parsed.business_landing_enabled !== undefined
        ? parsed.business_landing_enabled
          ? 1
          : 0
        : current.business_landing_enabled
          ? 1
          : 0,
    leads_enabled:
      parsed.leads_enabled !== undefined ? (parsed.leads_enabled ? 1 : 0) : current.leads_enabled ? 1 : 0,
    whatsapp_enabled:
      parsed.whatsapp_enabled !== undefined
        ? parsed.whatsapp_enabled
          ? 1
          : 0
        : current.whatsapp_enabled
          ? 1
          : 0,
    whatsapp_e164: parsed.whatsapp_e164 !== undefined ? parsed.whatsapp_e164 : current.whatsapp_e164,
    support_hours: parsed.support_hours ?? current.support_hours,
    starter_hero_image_url: parsed.starter_hero_image_url ?? current.starter_hero_image_url,
    trader_hero_image_url: parsed.trader_hero_image_url ?? current.trader_hero_image_url,
    proof_image_1_url: parsed.proof_image_1_url ?? current.proof_image_1_url,
    proof_image_2_url: parsed.proof_image_2_url ?? current.proof_image_2_url,
    crm_webhook_enabled:
      parsed.crm_webhook_enabled !== undefined
        ? parsed.crm_webhook_enabled
          ? 1
          : 0
        : current.crm_webhook_enabled
          ? 1
          : 0,
  };

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO b2b_settings (
      id, business_landing_enabled, leads_enabled, whatsapp_enabled, whatsapp_e164,
      support_hours, starter_hero_image_url, trader_hero_image_url,
      proof_image_1_url, proof_image_2_url, crm_webhook_enabled, updated_at
    ) VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      business_landing_enabled = excluded.business_landing_enabled,
      leads_enabled = excluded.leads_enabled,
      whatsapp_enabled = excluded.whatsapp_enabled,
      whatsapp_e164 = excluded.whatsapp_e164,
      support_hours = excluded.support_hours,
      starter_hero_image_url = excluded.starter_hero_image_url,
      trader_hero_image_url = excluded.trader_hero_image_url,
      proof_image_1_url = excluded.proof_image_1_url,
      proof_image_2_url = excluded.proof_image_2_url,
      crm_webhook_enabled = excluded.crm_webhook_enabled,
      updated_at = excluded.updated_at`
  ).run(
    next.business_landing_enabled,
    next.leads_enabled,
    next.whatsapp_enabled,
    next.whatsapp_e164,
    next.support_hours,
    next.starter_hero_image_url,
    next.trader_hero_image_url,
    next.proof_image_1_url,
    next.proof_image_2_url,
    next.crm_webhook_enabled,
    now
  );

  return getB2BSettings();
}

function mapOfferRow(row: Record<string, unknown>): B2BOfferRecord {
  return {
    id: String(row.id),
    code: String(row.code) as OfferCode,
    eyebrow_en: String(row.eyebrow_en),
    eyebrow_hi: String(row.eyebrow_hi),
    title_en: String(row.title_en),
    title_hi: String(row.title_hi),
    description_en: String(row.description_en),
    description_hi: String(row.description_hi),
    cta_label_en: String(row.cta_label_en),
    cta_label_hi: String(row.cta_label_hi),
    icon: (row.icon ? String(row.icon) : "package") as B2BOfferRecord["icon"],
    image_url: row.image_url ? String(row.image_url) : null,
    image_alt_en: row.image_alt_en ? String(row.image_alt_en) : null,
    image_alt_hi: row.image_alt_hi ? String(row.image_alt_hi) : null,
    sku_ids: safeJsonParse<string[]>(row.sku_ids_json as string, []),
    moq_text_en: row.moq_text_en ? String(row.moq_text_en) : null,
    moq_text_hi: row.moq_text_hi ? String(row.moq_text_hi) : null,
    pricing_mode: (row.pricing_mode ? String(row.pricing_mode) : "request_quote") as B2BOfferRecord["pricing_mode"],
    service_scope: safeJsonParse<string[]>(row.service_scope_json as string, []),
    active: Number(row.active) === 1,
    approved_at: row.approved_at ? String(row.approved_at) : null,
    approved_by: row.approved_by ? String(row.approved_by) : null,
    sort_order: Number(row.sort_order ?? 0),
    updated_at: String(row.updated_at),
  };
}

export function listAdminB2BOffers(): B2BOfferRecord[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM b2b_offers ORDER BY sort_order ASC, id ASC").all() as Array<
    Record<string, unknown>
  >;
  return rows.map(mapOfferRow);
}

export function listPublicB2BOffers(locale: BusinessLocale = "en"): PublicOfferView[] {
  return listAdminB2BOffers()
    .filter((o) => o.active && Boolean(o.approved_at))
    .map((o) => ({
      id: o.id,
      code: o.code,
      eyebrow: locale === "hi" ? o.eyebrow_hi : o.eyebrow_en,
      title: locale === "hi" ? o.title_hi : o.title_en,
      description: locale === "hi" ? o.description_hi : o.description_en,
      ctaLabel: locale === "hi" ? o.cta_label_hi : o.cta_label_en,
      icon: o.icon,
      imageUrl: o.image_url,
      imageAlt: locale === "hi" ? o.image_alt_hi : o.image_alt_en,
      skuIds: o.sku_ids,
      moqText: locale === "hi" ? o.moq_text_hi : o.moq_text_en,
      pricingMode: o.pricing_mode,
      serviceScope: o.service_scope,
      approvedAt: o.approved_at!,
    }));
}

export function upsertB2BOffer(input: unknown, actor = "admin"): B2BOfferRecord {
  const parsed = b2bOfferUpsertSchema.parse(input);
  const db = getDb();
  const existing = db
    .prepare("SELECT approved_at, approved_by FROM b2b_offers WHERE id = ?")
    .get(parsed.code) as { approved_at: string | null; approved_by: string | null } | undefined;

  const now = new Date().toISOString();
  const approvedAt = parsed.approve === true ? now : parsed.approve === false ? null : existing?.approved_at ?? now;
  const approvedBy = parsed.approve === true ? actor : parsed.approve === false ? null : existing?.approved_by ?? actor;

  db.prepare(
    `INSERT INTO b2b_offers (
      id, code, eyebrow_en, eyebrow_hi, title_en, title_hi,
      description_en, description_hi, cta_label_en, cta_label_hi,
      icon, image_url, image_alt_en, image_alt_hi,
      sku_ids_json, moq_text_en, moq_text_hi, pricing_mode,
      service_scope_json, active, approved_at, approved_by, sort_order, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      eyebrow_en = excluded.eyebrow_en,
      eyebrow_hi = excluded.eyebrow_hi,
      title_en = excluded.title_en,
      title_hi = excluded.title_hi,
      description_en = excluded.description_en,
      description_hi = excluded.description_hi,
      cta_label_en = excluded.cta_label_en,
      cta_label_hi = excluded.cta_label_hi,
      icon = excluded.icon,
      image_url = excluded.image_url,
      image_alt_en = excluded.image_alt_en,
      image_alt_hi = excluded.image_alt_hi,
      sku_ids_json = excluded.sku_ids_json,
      moq_text_en = excluded.moq_text_en,
      moq_text_hi = excluded.moq_text_hi,
      pricing_mode = excluded.pricing_mode,
      service_scope_json = excluded.service_scope_json,
      active = excluded.active,
      approved_at = excluded.approved_at,
      approved_by = excluded.approved_by,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at`
  ).run(
    parsed.code,
    parsed.code,
    parsed.eyebrow_en,
    parsed.eyebrow_hi,
    parsed.title_en,
    parsed.title_hi,
    parsed.description_en,
    parsed.description_hi,
    parsed.cta_label_en,
    parsed.cta_label_hi,
    parsed.icon,
    parsed.image_url ?? null,
    parsed.image_alt_en ?? null,
    parsed.image_alt_hi ?? null,
    JSON.stringify(parsed.sku_ids),
    parsed.moq_text_en ?? null,
    parsed.moq_text_hi ?? null,
    parsed.pricing_mode,
    JSON.stringify(parsed.service_scope),
    parsed.active ? 1 : 0,
    approvedAt,
    approvedBy,
    parsed.sort_order,
    now
  );

  const row = db.prepare("SELECT * FROM b2b_offers WHERE id = ?").get(parsed.code) as Record<string, unknown>;
  return mapOfferRow(row);
}

function mapPageContentRow(row: Record<string, unknown>): B2BPageContentRecord {
  return {
    id: String(row.id),
    segment: String(row.segment) as Segment,
    locale: String(row.locale) as BusinessLocale,
    eyebrow: String(row.eyebrow),
    headline: String(row.headline),
    intro: String(row.intro),
    primary_cta: String(row.primary_cta),
    secondary_cta: String(row.secondary_cta),
    hero_image_url: String(row.hero_image_url),
    hero_image_alt: String(row.hero_image_alt),
    process_intro: String(row.process_intro),
    steps: safeJsonParse<B2BPageStep[]>(row.steps_json as string, []),
    proof_title: String(row.proof_title),
    proof_body: String(row.proof_body),
    proof_items: safeJsonParse<B2BProofItem[]>(row.proof_items_json as string, []),
    form_heading: String(row.form_heading),
    form_subhead: String(row.form_subhead),
    faq: safeJsonParse<B2BFaqItem[]>(row.faq_json as string, []),
    seo_title: String(row.seo_title),
    seo_description: String(row.seo_description),
    approved_at: row.approved_at ? String(row.approved_at) : null,
    updated_at: String(row.updated_at),
  };
}

export function listAdminB2BPageContent(): B2BPageContentRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM b2b_page_content ORDER BY segment ASC, locale ASC")
    .all() as Array<Record<string, unknown>>;
  return rows.map(mapPageContentRow);
}

export function getB2BPageContent(segment: Segment, locale: BusinessLocale): B2BPageContentRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM b2b_page_content WHERE segment = ? AND locale = ?")
    .get(segment, locale) as Record<string, unknown> | undefined;
  if (row) return mapPageContentRow(row);
  if (locale !== "en") {
    const fallback = db
      .prepare("SELECT * FROM b2b_page_content WHERE segment = ? AND locale = 'en'")
      .get(segment) as Record<string, unknown> | undefined;
    if (fallback) return mapPageContentRow(fallback);
  }
  return null;
}

export function upsertB2BPageContent(input: unknown): B2BPageContentRecord {
  const parsed = b2bPageContentUpsertSchema.parse(input);
  const id = `${parsed.segment}:${parsed.locale}`;
  const db = getDb();
  const existing = db
    .prepare("SELECT approved_at FROM b2b_page_content WHERE id = ?")
    .get(id) as { approved_at: string | null } | undefined;
  const now = new Date().toISOString();
  const approvedAt = parsed.approve === true ? now : parsed.approve === false ? null : existing?.approved_at ?? now;

  db.prepare(
    `INSERT INTO b2b_page_content (
      id, segment, locale, eyebrow, headline, intro,
      primary_cta, secondary_cta, hero_image_url, hero_image_alt,
      process_intro, steps_json, proof_title, proof_body, proof_items_json,
      form_heading, form_subhead, faq_json, seo_title, seo_description, approved_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      eyebrow = excluded.eyebrow,
      headline = excluded.headline,
      intro = excluded.intro,
      primary_cta = excluded.primary_cta,
      secondary_cta = excluded.secondary_cta,
      hero_image_url = excluded.hero_image_url,
      hero_image_alt = excluded.hero_image_alt,
      process_intro = excluded.process_intro,
      steps_json = excluded.steps_json,
      proof_title = excluded.proof_title,
      proof_body = excluded.proof_body,
      proof_items_json = excluded.proof_items_json,
      form_heading = excluded.form_heading,
      form_subhead = excluded.form_subhead,
      faq_json = excluded.faq_json,
      seo_title = excluded.seo_title,
      seo_description = excluded.seo_description,
      approved_at = excluded.approved_at,
      updated_at = excluded.updated_at`
  ).run(
    id,
    parsed.segment,
    parsed.locale,
    parsed.eyebrow,
    parsed.headline,
    parsed.intro,
    parsed.primary_cta,
    parsed.secondary_cta,
    parsed.hero_image_url,
    parsed.hero_image_alt,
    parsed.process_intro,
    JSON.stringify(parsed.steps),
    parsed.proof_title,
    parsed.proof_body,
    JSON.stringify(parsed.proof_items),
    parsed.form_heading,
    parsed.form_subhead,
    JSON.stringify(parsed.faq),
    parsed.seo_title,
    parsed.seo_description,
    approvedAt,
    now
  );

  return getB2BPageContent(parsed.segment, parsed.locale)!;
}

function mapClaimRow(row: Record<string, unknown>): B2BClaimRecord {
  return {
    claim_key: String(row.claim_key),
    exact_copy_en: String(row.exact_copy_en),
    exact_copy_hi: String(row.exact_copy_hi),
    evidence_source: String(row.evidence_source),
    evidence_owner: String(row.evidence_owner),
    allowed_channels: safeJsonParse<B2BClaimRecord["allowed_channels"]>(
      row.allowed_channels_json as string,
      ["web", "sales"]
    ),
    active: Number(row.active) === 1,
    approved_at: row.approved_at ? String(row.approved_at) : null,
    valid_until: row.valid_until ? String(row.valid_until) : null,
    updated_at: String(row.updated_at),
  };
}

export function listAdminB2BClaims(): B2BClaimRecord[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM b2b_claims ORDER BY claim_key ASC").all() as Array<Record<string, unknown>>;
  return rows.map(mapClaimRow);
}

export function listPublicB2BClaims(channel: "web" | "meta" | "google" | "sales" = "web"): B2BClaimRecord[] {
  const now = Date.now();
  return listAdminB2BClaims().filter((c) => {
    if (!c.active || !c.approved_at) return false;
    if (!c.allowed_channels.includes(channel)) return false;
    if (c.valid_until && Date.parse(c.valid_until) < now) return false;
    return true;
  });
}

export function upsertB2BClaim(input: unknown): B2BClaimRecord {
  const parsed = b2bClaimUpsertSchema.parse(input);
  const db = getDb();
  const existing = db
    .prepare("SELECT approved_at FROM b2b_claims WHERE claim_key = ?")
    .get(parsed.claim_key) as { approved_at: string | null } | undefined;
  const now = new Date().toISOString();
  const approvedAt = parsed.approve === true ? now : parsed.approve === false ? null : existing?.approved_at ?? now;

  db.prepare(
    `INSERT INTO b2b_claims (
      claim_key, exact_copy_en, exact_copy_hi, evidence_source, evidence_owner,
      allowed_channels_json, active, approved_at, valid_until, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(claim_key) DO UPDATE SET
      exact_copy_en = excluded.exact_copy_en,
      exact_copy_hi = excluded.exact_copy_hi,
      evidence_source = excluded.evidence_source,
      evidence_owner = excluded.evidence_owner,
      allowed_channels_json = excluded.allowed_channels_json,
      active = excluded.active,
      approved_at = excluded.approved_at,
      valid_until = excluded.valid_until,
      updated_at = excluded.updated_at`
  ).run(
    parsed.claim_key,
    parsed.exact_copy_en,
    parsed.exact_copy_hi,
    parsed.evidence_source,
    parsed.evidence_owner,
    JSON.stringify(parsed.allowed_channels),
    parsed.active ? 1 : 0,
    approvedAt,
    parsed.valid_until ?? null,
    now
  );

  const row = db.prepare("SELECT * FROM b2b_claims WHERE claim_key = ?").get(parsed.claim_key) as Record<
    string,
    unknown
  >;
  return mapClaimRow(row);
}

export function createBusinessLeadWithOutbox(
  input: BusinessLeadInput,
  idempotencyKey: string
): { reference: string; leadId: string; duplicate: boolean } {
  const db = getDb();
  const fingerprint = computeLeadFingerprint(input);

  const existing = db
    .prepare("SELECT id, reference, request_fingerprint FROM b2b_leads WHERE idempotency_key = ?")
    .get(idempotencyKey) as { id: string; reference: string; request_fingerprint: string } | undefined;

  if (existing) {
    if (existing.request_fingerprint !== fingerprint) {
      throw new IdempotencyConflictError();
    }
    return { reference: existing.reference, leadId: existing.id, duplicate: true };
  }

  const leadId = randomUUID();
  const reference = generateLeadReference();
  const now = new Date().toISOString();

  const runTx = db.transaction(() => {
    db.prepare(
      `INSERT INTO b2b_leads (
        id, reference, idempotency_key, request_fingerprint,
        segment, interest, quantity_band, pincode, name, phone,
        company, note, locale, status,
        contact_consent_at, marketing_consent_at,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        gclid, gbraid, wbraid, fbclid, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      leadId,
      reference,
      idempotencyKey,
      fingerprint,
      input.segment,
      input.interest,
      input.quantityBand,
      input.pincode,
      input.name,
      input.phone,
      input.company ?? null,
      input.note ?? null,
      input.locale,
      now,
      input.marketingConsent ? now : null,
      input.attribution.utm_source ?? null,
      input.attribution.utm_medium ?? null,
      input.attribution.utm_campaign ?? null,
      input.attribution.utm_content ?? null,
      input.attribution.utm_term ?? null,
      input.attribution.gclid ?? null,
      input.attribution.gbraid ?? null,
      input.attribution.wbraid ?? null,
      input.attribution.fbclid ?? null,
      now,
      now
    );

    db.prepare(
      `INSERT INTO b2b_lead_events (id, lead_id, type, actor_id, metadata_json, external_key, event_time)
       VALUES (?, ?, 'lead.created', 'public_form', ?, ?, ?)`
    ).run(
      randomUUID(),
      leadId,
      JSON.stringify({ segment: input.segment, interest: input.interest, quantityBand: input.quantityBand }),
      `lead:created:${leadId}`,
      now
    );

    db.prepare(
      `INSERT INTO b2b_integration_outbox (id, topic, aggregate_id, payload_json, status, dedupe_key, created_at)
       VALUES (?, 'crm.business_lead.created', ?, ?, 'pending', ?, ?)`
    ).run(
      randomUUID(),
      leadId,
      JSON.stringify({ leadId, reference, segment: input.segment, interest: input.interest }),
      `crm:created:${leadId}`,
      now
    );
  });

  try {
    runTx();
  } catch (err) {
    const retryExisting = db
      .prepare("SELECT id, reference, request_fingerprint FROM b2b_leads WHERE idempotency_key = ?")
      .get(idempotencyKey) as { id: string; reference: string; request_fingerprint: string } | undefined;
    if (retryExisting) {
      if (retryExisting.request_fingerprint !== fingerprint) {
        throw new IdempotencyConflictError();
      }
      return { reference: retryExisting.reference, leadId: retryExisting.id, duplicate: true };
    }
    throw err;
  }

  return { reference, leadId, duplicate: false };
}

function mapLeadRow(row: Record<string, unknown>): B2BLeadRecord {
  return {
    id: String(row.id),
    reference: String(row.reference),
    segment: String(row.segment) as Segment,
    interest: String(row.interest) as BusinessLeadInput["interest"],
    quantity_band: String(row.quantity_band) as BusinessLeadInput["quantityBand"],
    pincode: String(row.pincode),
    name: String(row.name),
    phone: String(row.phone),
    company: row.company ? String(row.company) : null,
    note: row.note ? String(row.note) : null,
    locale: (row.locale ? String(row.locale) : "en") as BusinessLocale,
    status: String(row.status) as BusinessLeadStatus,
    qualification_reason: row.qualification_reason ? String(row.qualification_reason) : null,
    owner_id: row.owner_id ? String(row.owner_id) : null,
    contact_consent_at: String(row.contact_consent_at),
    marketing_consent_at: row.marketing_consent_at ? String(row.marketing_consent_at) : null,
    utm_source: row.utm_source ? String(row.utm_source) : null,
    utm_medium: row.utm_medium ? String(row.utm_medium) : null,
    utm_campaign: row.utm_campaign ? String(row.utm_campaign) : null,
    utm_content: row.utm_content ? String(row.utm_content) : null,
    utm_term: row.utm_term ? String(row.utm_term) : null,
    gclid: row.gclid ? String(row.gclid) : null,
    gbraid: row.gbraid ? String(row.gbraid) : null,
    wbraid: row.wbraid ? String(row.wbraid) : null,
    fbclid: row.fbclid ? String(row.fbclid) : null,
    first_contact_at: row.first_contact_at ? String(row.first_contact_at) : null,
    qualified_at: row.qualified_at ? String(row.qualified_at) : null,
    quoted_at: row.quoted_at ? String(row.quoted_at) : null,
    won_at: row.won_at ? String(row.won_at) : null,
    lost_at: row.lost_at ? String(row.lost_at) : null,
    quoted_amount_paise: row.quoted_amount_paise !== null && row.quoted_amount_paise !== undefined ? Number(row.quoted_amount_paise) : null,
    first_order_id: row.first_order_id ? String(row.first_order_id) : null,
    deletion_requested_at: row.deletion_requested_at ? String(row.deletion_requested_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function listAdminB2BLeads(filters?: {
  segment?: Segment;
  status?: BusinessLeadStatus;
  limit?: number;
}): B2BLeadRecord[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters?.segment) {
    clauses.push("segment = ?");
    params.push(filters.segment);
  }
  if (filters?.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
  params.push(limit);

  const rows = db
    .prepare(`SELECT * FROM b2b_leads ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params) as Array<Record<string, unknown>>;

  return rows.map(mapLeadRow);
}

export function getAdminB2BLeadDetail(idOrRef: string): {
  lead: B2BLeadRecord;
  events: B2BLeadEventRecord[];
  quotes: B2BQuoteRecord[];
} {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM b2b_leads WHERE id = ? OR reference = ?")
    .get(idOrRef, idOrRef) as Record<string, unknown> | undefined;
  if (!row) {
    throw new BusinessNotFoundError("Business lead not found.");
  }

  const lead = mapLeadRow(row);
  const eventRows = db
    .prepare("SELECT * FROM b2b_lead_events WHERE lead_id = ? ORDER BY event_time DESC")
    .all(lead.id) as Array<Record<string, unknown>>;
  const quoteRows = db
    .prepare("SELECT * FROM b2b_quotes WHERE lead_id = ? ORDER BY version DESC, created_at DESC")
    .all(lead.id) as Array<Record<string, unknown>>;

  return {
    lead,
    events: eventRows.map((e) => ({
      id: String(e.id),
      lead_id: String(e.lead_id),
      type: String(e.type),
      actor_id: e.actor_id ? String(e.actor_id) : null,
      metadata: safeJsonParse<Record<string, unknown> | null>(e.metadata_json as string | null, null),
      external_key: e.external_key ? String(e.external_key) : null,
      event_time: String(e.event_time),
    })),
    quotes: quoteRows.map((q) => ({
      id: String(q.id),
      lead_id: String(q.lead_id),
      quote_number: String(q.quote_number),
      version: Number(q.version),
      line_items: safeJsonParse<B2BQuoteRecord["line_items"]>(q.line_items_json as string, []),
      freight_paise: Number(q.freight_paise ?? 0),
      tax_paise: Number(q.tax_paise ?? 0),
      total_paise: Number(q.total_paise ?? 0),
      freight_terms: String(q.freight_terms),
      valid_until: q.valid_until ? String(q.valid_until) : null,
      notes: q.notes ? String(q.notes) : null,
      status: String(q.status) as B2BQuoteRecord["status"],
      created_by: q.created_by ? String(q.created_by) : null,
      created_at: String(q.created_at),
    })),
  };
}

const ALLOWED_TRANSITIONS: Record<BusinessLeadStatus, BusinessLeadStatus[]> = {
  new: ["new", "contact_attempted", "disqualified"],
  contact_attempted: ["contact_attempted", "qualified", "disqualified"],
  qualified: ["qualified", "quote_sent", "lost"],
  disqualified: ["disqualified"],
  quote_sent: ["quote_sent", "won", "lost"],
  won: ["won"],
  lost: ["lost"],
};

export function transitionB2BLeadStatus(
  idOrRef: string,
  input: unknown,
  actorId = "admin"
): B2BLeadRecord {
  const parsed = b2bLeadTransitionSchema.parse(input);
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM b2b_leads WHERE id = ? OR reference = ?")
    .get(idOrRef, idOrRef) as Record<string, unknown> | undefined;

  if (!row) {
    throw new BusinessNotFoundError("Business lead not found.");
  }

  const current = mapLeadRow(row);
  const allowed = ALLOWED_TRANSITIONS[current.status];
  if (!allowed.includes(parsed.status)) {
    throw new LeadTransitionError(
      `Invalid lead transition from '${current.status}' to '${parsed.status}'.`
    );
  }

  if (parsed.status === "won" && !parsed.first_order_id && !current.first_order_id) {
    throw new LeadTransitionError(
      "Winning a B2B lead requires a verified paid order ID (first_order_id)."
    );
  }

  const now = new Date().toISOString();
  const nextFirstContact =
    parsed.status === "contact_attempted" && !current.first_contact_at ? now : current.first_contact_at;
  const nextQualified =
    parsed.status === "qualified" && !current.qualified_at ? now : current.qualified_at;
  const nextQuoted =
    parsed.status === "quote_sent" && !current.quoted_at ? now : current.quoted_at;
  const nextWon = parsed.status === "won" && !current.won_at ? now : current.won_at;
  const nextLost = parsed.status === "lost" && !current.lost_at ? now : current.lost_at;
  const nextDeletion =
    parsed.request_deletion && !current.deletion_requested_at ? now : current.deletion_requested_at;

  const runTx = db.transaction(() => {
    db.prepare(
      `UPDATE b2b_leads SET
        status = ?,
        qualification_reason = COALESCE(?, qualification_reason),
        owner_id = COALESCE(?, owner_id),
        quoted_amount_paise = COALESCE(?, quoted_amount_paise),
        first_order_id = COALESCE(?, first_order_id),
        first_contact_at = ?,
        qualified_at = ?,
        quoted_at = ?,
        won_at = ?,
        lost_at = ?,
        deletion_requested_at = ?,
        updated_at = ?
      WHERE id = ?`
    ).run(
      parsed.status,
      parsed.qualification_reason ?? null,
      parsed.owner_id ?? null,
      parsed.quoted_amount_paise ?? null,
      parsed.first_order_id ?? null,
      nextFirstContact,
      nextQualified,
      nextQuoted,
      nextWon,
      nextLost,
      nextDeletion,
      now,
      current.id
    );

    db.prepare(
      `INSERT INTO b2b_lead_events (id, lead_id, type, actor_id, metadata_json, event_time)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      current.id,
      `lead.status.${parsed.status}`,
      actorId,
      JSON.stringify({
        from: current.status,
        to: parsed.status,
        reason: parsed.qualification_reason ?? null,
        note: parsed.note ?? null,
      }),
      now
    );

    if (parsed.status === "qualified" && current.status !== "qualified") {
      db.prepare(
        `INSERT INTO b2b_integration_outbox (id, topic, aggregate_id, payload_json, status, dedupe_key, created_at)
         VALUES (?, 'conversion.qualified_business_lead', ?, ?, 'pending', ?, ?)
         ON CONFLICT(dedupe_key) DO NOTHING`
      ).run(
        randomUUID(),
        current.id,
        JSON.stringify({ leadId: current.id, reference: current.reference, segment: current.segment }),
        `conv:qualified:${current.id}`,
        now
      );
    }

    if (parsed.status === "won" && current.status !== "won") {
      db.prepare(
        `INSERT INTO b2b_integration_outbox (id, topic, aggregate_id, payload_json, status, dedupe_key, created_at)
         VALUES (?, 'conversion.first_b2b_paid_order', ?, ?, 'pending', ?, ?)
         ON CONFLICT(dedupe_key) DO NOTHING`
      ).run(
        randomUUID(),
        current.id,
        JSON.stringify({
          leadId: current.id,
          reference: current.reference,
          firstOrderId: parsed.first_order_id ?? current.first_order_id,
          quotedAmountPaise: parsed.quoted_amount_paise ?? current.quoted_amount_paise,
        }),
        `conv:won:${current.id}`,
        now
      );
    }
  });

  runTx();
  return getAdminB2BLeadDetail(current.id).lead;
}

export function createB2BQuote(input: unknown, actorId = "admin"): B2BQuoteRecord {
  const parsed = b2bQuoteCreateSchema.parse(input);
  const db = getDb();
  const detail = getAdminB2BLeadDetail(parsed.lead_id);
  const lead = detail.lead;

  const subtotalPaise = parsed.line_items.reduce((sum, item) => sum + item.line_total_paise, 0);
  const totalPaise = subtotalPaise + parsed.freight_paise + parsed.tax_paise;
  const nextVersion = (detail.quotes[0]?.version ?? 0) + 1;
  const quoteId = randomUUID();
  const quoteNumber = `QT-${lead.reference.replace("TFB-", "")}-V${nextVersion}`;
  const now = new Date().toISOString();
  const quoteStatus = parsed.mark_sent ? "sent" : "draft";

  const runTx = db.transaction(() => {
    db.prepare(
      `INSERT INTO b2b_quotes (
        id, lead_id, quote_number, version, line_items_json,
        freight_paise, tax_paise, total_paise, freight_terms,
        valid_until, notes, status, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      quoteId,
      lead.id,
      quoteNumber,
      nextVersion,
      JSON.stringify(parsed.line_items),
      parsed.freight_paise,
      parsed.tax_paise,
      totalPaise,
      parsed.freight_terms,
      parsed.valid_until ?? null,
      parsed.notes ?? null,
      quoteStatus,
      actorId,
      now
    );

    if (parsed.mark_sent && (lead.status === "qualified" || lead.status === "quote_sent")) {
      db.prepare(
        `UPDATE b2b_leads SET status = 'quote_sent', quoted_at = COALESCE(quoted_at, ?), quoted_amount_paise = ?, updated_at = ? WHERE id = ?`
      ).run(now, totalPaise, now, lead.id);
    }

    db.prepare(
      `INSERT INTO b2b_lead_events (id, lead_id, type, actor_id, metadata_json, event_time)
       VALUES (?, ?, 'quote.created', ?, ?, ?)`
    ).run(
      randomUUID(),
      lead.id,
      actorId,
      JSON.stringify({ quoteId, quoteNumber, version: nextVersion, totalPaise, status: quoteStatus }),
      now
    );
  });

  runTx();
  return getAdminB2BLeadDetail(lead.id).quotes.find((q) => q.id === quoteId)!;
}

export function listB2BOutbox(status?: B2BOutboxRecord["status"]): B2BOutboxRecord[] {
  const db = getDb();
  const rows = status
    ? (db
        .prepare("SELECT * FROM b2b_integration_outbox WHERE status = ? ORDER BY created_at DESC LIMIT 100")
        .all(status) as Array<Record<string, unknown>>)
    : (db
        .prepare("SELECT * FROM b2b_integration_outbox ORDER BY created_at DESC LIMIT 100")
        .all() as Array<Record<string, unknown>>);

  return rows.map((r) => ({
    id: String(r.id),
    topic: String(r.topic),
    aggregate_id: String(r.aggregate_id),
    payload: safeJsonParse<Record<string, unknown>>(r.payload_json as string, {}),
    attempt: Number(r.attempt ?? 0),
    status: String(r.status) as B2BOutboxRecord["status"],
    last_error: r.last_error ? String(r.last_error) : null,
    dedupe_key: String(r.dedupe_key),
    created_at: String(r.created_at),
    processed_at: r.processed_at ? String(r.processed_at) : null,
  }));
}

export function retryB2BOutboxItem(id: string): B2BOutboxRecord {
  const db = getDb();
  const res = db
    .prepare("UPDATE b2b_integration_outbox SET status = 'pending', last_error = NULL WHERE id = ?")
    .run(id);
  if (res.changes === 0) {
    throw new BusinessNotFoundError("Outbox item not found.");
  }
  const row = db.prepare("SELECT * FROM b2b_integration_outbox WHERE id = ?").get(id) as Record<string, unknown>;
  return {
    id: String(row.id),
    topic: String(row.topic),
    aggregate_id: String(row.aggregate_id),
    payload: safeJsonParse<Record<string, unknown>>(row.payload_json as string, {}),
    attempt: Number(row.attempt ?? 0),
    status: String(row.status) as B2BOutboxRecord["status"],
    last_error: row.last_error ? String(row.last_error) : null,
    dedupe_key: String(row.dedupe_key),
    created_at: String(row.created_at),
    processed_at: row.processed_at ? String(row.processed_at) : null,
  };
}

export function getB2BFunnelSummary() {
  const db = getDb();
  const totalLeads = (
    db.prepare("SELECT COUNT(*) AS count FROM b2b_leads").get() as { count: number } | undefined
  )?.count ?? 0;
  const byStatusRows = db
    .prepare("SELECT status, COUNT(*) AS count FROM b2b_leads GROUP BY status")
    .all() as Array<{ status: string; count: number }>;
  const bySegmentRows = db
    .prepare("SELECT segment, COUNT(*) AS count FROM b2b_leads GROUP BY segment")
    .all() as Array<{ segment: string; count: number }>;
  const pendingOutbox = (
    db.prepare("SELECT COUNT(*) AS count FROM b2b_integration_outbox WHERE status = 'pending'").get() as
      | { count: number }
      | undefined
  )?.count ?? 0;

  return {
    totalLeads: Number(totalLeads),
    byStatus: Object.fromEntries(byStatusRows.map((r) => [r.status, Number(r.count)])),
    bySegment: Object.fromEntries(bySegmentRows.map((r) => [r.segment, Number(r.count)])),
    pendingOutbox: Number(pendingOutbox),
  };
}
