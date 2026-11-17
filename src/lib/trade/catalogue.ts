import { tradeImage } from "./media";
import { publicTradePilots } from "./publicPilots";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { enabledProductCondition } from "@/lib/productAvailability";
import { TrialService } from "@/lib/trials/service";
import type { TrialPublicDto } from "@/lib/trials/types";
import {
  ALL_TRADE_LOCALES,
  TradeLaneUpsertSchema,
  TradeLocalizedContentUpsertSchema,
  TradeOfferUpsertSchema,
  TradeSettingsUpdateSchema,
  TradeSharedPilotUpsertSchema,
  TradeEnquiryUpdateSchema,
  TradeOrderReconcileSchema,
  type AnyTradeLocale,
} from "./contracts";

export type TradeSettings = {
  id: string;
  channel_enabled: boolean;
  enabled_locales: AnyTradeLocale[];
  staged_locales: AnyTradeLocale[];
  featured_trial_id: string | null;
  trial_parcel_rate_paise: number;
  trial_credit_paise: number;
  trial_credit_min_qty_kg: number;
  trial_credit_expiry_days: number;
  whatsapp_number: string;
  support_hours: string;
  dispatch_cutoff_label: string;
  hero_image_url: string;
  hero_video_url: string | null;
  hero_video_poster_url: string | null;
  trial_image_url: string;
  updated_at: string;
};

export type TradeVariantDto = {
  id: number;
  sku: string;
  grams: number;
  pricePaise: number;
  stock: number;
  inStock: boolean;
};

export type TradeProductDto = {
  offerId: number;
  productId: number;
  slug: string;
  name: string;
  category: string;
  origin: string;
  estate: string;
  description: string;
  tastingNotes: string;
  brewTemp: number;
  brewSeconds: number;
  badgeText: string | null;
  featuredOrder: number;
  defaultVariantId: number | null;
  variants: TradeVariantDto[];
  imageUrl: string | null;
};

export type TradeLaneRecord = {
  id: string;
  lane_code: string;
  version: number;
  is_active: boolean;
  origin_pin: string;
  pin_start: string;
  pin_end: string;
  service_code: string;
  service_label: string;
  handover_kind: "doorstep" | "depot";
  locality_label: string;
  depot_name: string | null;
  depot_address: string | null;
  onward_included: boolean;
  billed_weight_rule: "gross" | "max_gross_dim";
  dim_divisor: number;
  billing_increment_grams: number;
  tare_grams: number;
  box_length_cm: number;
  box_width_cm: number;
  box_height_cm: number;
  max_net_grams: number;
  max_billed_grams: number;
  base_freight_paise: number;
  per_kg_freight_paise: number;
  last_mile_paise: number;
  extra_tax_bps: number;
  other_fees_paise: number;
  cod_allowed: boolean;
  cod_fee_paise: number;
  cod_max_total_paise: number | null;
  freight_advance_allowed: boolean;
  eta_label: string;
  operator_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export type TradeLocalizedContentRecord = {
  id: number;
  resource_key: string;
  locale: AnyTradeLocale;
  source_revision: number;
  text_value: string;
  audio_url: string | null;
  transcript: string | null;
  review_status: "draft" | "reviewed" | "needs_review";
  updated_by: string | null;
  updated_at: string;
};

export type TradeSharedPilotRecord = {
  id: string;
  town_name: string;
  pin_prefix: string;
  collection_point: string;
  collection_address: string;
  local_fee_paise: number;
  cutoff_at: string;
  dispatch_partner: string;
  dispatch_schedule: string;
  target_kg: number;
  booked_kg: number;
  status: "active" | "paused" | "dispatched" | "cancelled";
  created_at: string;
  updated_at: string;
};

function parseJsonArray<T>(raw: string | null | undefined, fallback: T[]): T[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function getTradeSettings(): TradeSettings {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM trade_settings WHERE id = 'default'")
    .get() as Record<string, unknown> | undefined;

  if (!row) {
    return {
      id: "default",
      channel_enabled: true,
      enabled_locales: ["en", "hi", "bn", "pa", "mr", "gu", "ta", "te"],
      staged_locales: ["kn"],
      featured_trial_id: null,
      trial_parcel_rate_paise: 0,
      trial_credit_paise: 0,
      trial_credit_min_qty_kg: 25,
      trial_credit_expiry_days: 30,
      whatsapp_number: "+917001304853",
      support_hours: "Mon-Sat 9:00 AM - 7:00 PM IST",
      dispatch_cutoff_label: "Dispatched next business day from Siliguri",
      hero_image_url: tradeImage(null, "hero"),
      hero_video_url: null,
      hero_video_poster_url: null,
      trial_image_url: tradeImage(null, "trial"),
      updated_at: new Date().toISOString(),
    };
  }

  return {
    id: String(row.id),
    channel_enabled: Boolean(row.channel_enabled),
    enabled_locales: parseJsonArray<AnyTradeLocale>(
      row.enabled_locales_json as string,
      ["en", "bn", "hi", "gu", "mr"]
    ).filter((l) => (ALL_TRADE_LOCALES as readonly string[]).includes(l)),
    staged_locales: parseJsonArray<AnyTradeLocale>(
      row.staged_locales_json as string,
      ["pa", "ta", "te", "kn"]
    ).filter((l) => (ALL_TRADE_LOCALES as readonly string[]).includes(l)),
    featured_trial_id: row.featured_trial_id ? String(row.featured_trial_id) : null,
    trial_parcel_rate_paise: Number(row.trial_parcel_rate_paise ?? 0),
    trial_credit_paise: Number(row.trial_credit_paise ?? 0),
    trial_credit_min_qty_kg: Number(row.trial_credit_min_qty_kg ?? 25),
    trial_credit_expiry_days: Number(row.trial_credit_expiry_days ?? 30),
    whatsapp_number: String(row.whatsapp_number ?? "+917001304853"),
    support_hours: String(row.support_hours ?? "Mon-Sat 9:00 AM - 7:00 PM IST"),
    dispatch_cutoff_label: String(
      row.dispatch_cutoff_label ?? "Dispatched next business day from Siliguri"
    ),
    hero_image_url: tradeImage(row.hero_image_url as string, "hero"),
    hero_video_url: row.hero_video_url ? String(row.hero_video_url) : null,
    hero_video_poster_url: row.hero_video_poster_url
      ? String(row.hero_video_poster_url)
      : null,
    trial_image_url: tradeImage(row.trial_image_url as string, "trial"),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export function updateTradeSettings(raw: unknown): TradeSettings {
  const input = TradeSettingsUpdateSchema.parse(raw);
  const current = getTradeSettings();
  const db = getDb();

  const next = {
    channel_enabled: input.channel_enabled ?? current.channel_enabled,
    enabled_locales: input.enabled_locales ?? current.enabled_locales,
    staged_locales: input.staged_locales ?? current.staged_locales,
    featured_trial_id:
      input.featured_trial_id !== undefined
        ? input.featured_trial_id
        : current.featured_trial_id,
    trial_parcel_rate_paise:
      input.trial_parcel_rate_paise ?? current.trial_parcel_rate_paise,
    trial_credit_paise: input.trial_credit_paise ?? current.trial_credit_paise,
    trial_credit_min_qty_kg:
      input.trial_credit_min_qty_kg ?? current.trial_credit_min_qty_kg,
    trial_credit_expiry_days:
      input.trial_credit_expiry_days ?? current.trial_credit_expiry_days,
    whatsapp_number: input.whatsapp_number ?? current.whatsapp_number,
    support_hours: input.support_hours ?? current.support_hours,
    dispatch_cutoff_label:
      input.dispatch_cutoff_label ?? current.dispatch_cutoff_label,
    hero_image_url: input.hero_image_url ?? current.hero_image_url,
    hero_video_url:
      input.hero_video_url !== undefined ? input.hero_video_url : current.hero_video_url,
    hero_video_poster_url:
      input.hero_video_poster_url !== undefined
        ? input.hero_video_poster_url
        : current.hero_video_poster_url,
    trial_image_url: input.trial_image_url ?? current.trial_image_url,
  };

  db.prepare(`
    INSERT INTO trade_settings (
      id, channel_enabled, enabled_locales_json, staged_locales_json,
      featured_trial_id, trial_parcel_rate_paise, trial_credit_paise,
      trial_credit_min_qty_kg, trial_credit_expiry_days,
      whatsapp_number, support_hours, dispatch_cutoff_label,
      hero_image_url, hero_video_url, hero_video_poster_url, trial_image_url, updated_at
    ) VALUES (
      'default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      channel_enabled = excluded.channel_enabled,
      enabled_locales_json = excluded.enabled_locales_json,
      staged_locales_json = excluded.staged_locales_json,
      featured_trial_id = excluded.featured_trial_id,
      trial_parcel_rate_paise = excluded.trial_parcel_rate_paise,
      trial_credit_paise = excluded.trial_credit_paise,
      trial_credit_min_qty_kg = excluded.trial_credit_min_qty_kg,
      trial_credit_expiry_days = excluded.trial_credit_expiry_days,
      whatsapp_number = excluded.whatsapp_number,
      support_hours = excluded.support_hours,
      dispatch_cutoff_label = excluded.dispatch_cutoff_label,
      hero_image_url = excluded.hero_image_url,
      hero_video_url = excluded.hero_video_url,
      hero_video_poster_url = excluded.hero_video_poster_url,
      trial_image_url = excluded.trial_image_url,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    next.channel_enabled ? 1 : 0,
    JSON.stringify(next.enabled_locales),
    JSON.stringify(next.staged_locales),
    next.featured_trial_id,
    next.trial_parcel_rate_paise,
    next.trial_credit_paise,
    next.trial_credit_min_qty_kg,
    next.trial_credit_expiry_days,
    next.whatsapp_number,
    next.support_hours,
    next.dispatch_cutoff_label,
    next.hero_image_url,
    next.hero_video_url,
    next.hero_video_poster_url,
    next.trial_image_url
  );

  return getTradeSettings();
}

export function getPublicTradeTrial(settings = getTradeSettings()): TrialPublicDto | null {
  try {
    if (settings.featured_trial_id) {
      const details = TrialService.getById(settings.featured_trial_id);
      if (details && details.status === "published") {
        return TrialService.toPublicDto(details);
      }
      const bySlug = TrialService.getPublicBySlug(settings.featured_trial_id);
      if (bySlug) return bySlug;
      return null;
    }
    const { trials } = TrialService.listPublic({ limit: 1 });
    return trials[0] ?? null;
  } catch {
    return null;
  }
}

export function listPublicTradeProducts(): TradeProductDto[] {
  const db = getDb();
  const nowIso = new Date().toISOString();

  const offers = db
    .prepare(
      `
      SELECT o.id AS offer_id, o.product_id, o.featured_order, o.eligible_variant_ids_json,
             o.default_variant_id, o.starts_at, o.ends_at, o.badge_text,
             p.slug, p.name, p.category, p.origin, p.estate, p.description,
             p.tasting_notes, p.brew_temp, p.brew_seconds
      FROM trade_offers o
      JOIN products p ON p.id = o.product_id
      WHERE o.published = 1
        AND ${enabledProductCondition("p")}
        AND (o.starts_at IS NULL OR o.starts_at <= ?)
        AND (o.ends_at IS NULL OR o.ends_at >= ?)
      ORDER BY o.featured_order ASC, p.id ASC
    `
    )
    .all(nowIso, nowIso) as Array<Record<string, unknown>>;

  const result: TradeProductDto[] = [];
  for (const row of offers) {
    const productId = Number(row.product_id);
    const eligibleIds = parseJsonArray<number>(
      row.eligible_variant_ids_json as string,
      []
    );

    const variantsRows = db
      .prepare(
        "SELECT id, sku, grams, price_paise, stock FROM variants WHERE product_id = ? ORDER BY grams ASC, id ASC"
      )
      .all(productId) as Array<{
      id: number;
      sku: string;
      grams: number;
      price_paise: number;
      stock: number;
    }>;

    const filteredVariants =
      eligibleIds.length > 0
        ? variantsRows.filter((v) => eligibleIds.includes(v.id))
        : variantsRows;

    if (filteredVariants.length === 0) continue;

    let imageUrl: string | null = null;
    try {
      const img = db
        .prepare(
          "SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1"
        )
        .get(productId) as { url?: string } | undefined;
      imageUrl = img?.url ?? null;
    } catch {
      imageUrl = null;
    }

    result.push({
      offerId: Number(row.offer_id),
      productId,
      slug: String(row.slug),
      name: String(row.name),
      category: String(row.category),
      origin: String(row.origin),
      estate: String(row.estate),
      description: String(row.description),
      tastingNotes: String(row.tasting_notes),
      brewTemp: Number(row.brew_temp),
      brewSeconds: Number(row.brew_seconds),
      badgeText: row.badge_text ? String(row.badge_text) : null,
      featuredOrder: Number(row.featured_order),
      defaultVariantId: row.default_variant_id ? Number(row.default_variant_id) : null,
      variants: filteredVariants.map((v) => ({
        id: v.id,
        sku: v.sku,
        grams: v.grams,
        pricePaise: v.price_paise,
        stock: v.stock,
        inStock: v.stock > 0,
      })),
      imageUrl,
    });
  }

  return result;
}

export function listAllTradeOffersAdmin() {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT o.*, p.slug AS product_slug, p.name AS product_name,
        CASE WHEN COALESCE(p.status, 'published') = 'published' THEN 1 ELSE 0 END AS product_enabled
      FROM trade_offers o
      JOIN products p ON p.id = o.product_id
      ORDER BY o.featured_order ASC, o.id ASC
    `
    )
    .all() as Array<Record<string, unknown>>;
}

export function upsertTradeOffer(raw: unknown) {
  const input = TradeOfferUpsertSchema.parse(raw);
  const db = getDb();
  const product = db
    .prepare("SELECT id FROM products WHERE id = ?")
    .get(input.product_id) as { id: number } | undefined;
  if (!product) {
    throw new Error(`Product ${input.product_id} not found.`);
  }

  db.prepare(`
    INSERT INTO trade_offers (
      product_id, featured_order, eligible_variant_ids_json, default_variant_id,
      starts_at, ends_at, published, badge_text, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(product_id) DO UPDATE SET
      featured_order = excluded.featured_order,
      eligible_variant_ids_json = excluded.eligible_variant_ids_json,
      default_variant_id = excluded.default_variant_id,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      published = excluded.published,
      badge_text = excluded.badge_text,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    input.product_id,
    input.featured_order,
    JSON.stringify(input.eligible_variant_ids),
    input.default_variant_id ?? null,
    input.starts_at ?? null,
    input.ends_at ?? null,
    input.published ? 1 : 0,
    input.badge_text ?? null,
    input.notes ?? null
  );

  return db
    .prepare("SELECT * FROM trade_offers WHERE product_id = ?")
    .get(input.product_id);
}

export function deleteTradeOffer(productId: number): boolean {
  const res = getDb()
    .prepare("DELETE FROM trade_offers WHERE product_id = ?")
    .run(productId);
  return res.changes > 0;
}

function mapLaneRow(row: Record<string, unknown>): TradeLaneRecord {
  return {
    id: String(row.id),
    lane_code: String(row.lane_code),
    version: Number(row.version),
    is_active: Boolean(row.is_active),
    origin_pin: String(row.origin_pin),
    pin_start: String(row.pin_start),
    pin_end: String(row.pin_end),
    service_code: String(row.service_code),
    service_label: String(row.service_label),
    handover_kind: row.handover_kind === "depot" ? "depot" : "doorstep",
    locality_label: String(row.locality_label ?? ""),
    depot_name: row.depot_name ? String(row.depot_name) : null,
    depot_address: row.depot_address ? String(row.depot_address) : null,
    onward_included: Boolean(row.onward_included),
    billed_weight_rule:
      row.billed_weight_rule === "gross" ? "gross" : "max_gross_dim",
    dim_divisor: Number(row.dim_divisor),
    billing_increment_grams: Number(row.billing_increment_grams),
    tare_grams: Number(row.tare_grams),
    box_length_cm: Number(row.box_length_cm),
    box_width_cm: Number(row.box_width_cm),
    box_height_cm: Number(row.box_height_cm),
    max_net_grams: Number(row.max_net_grams),
    max_billed_grams: Number(row.max_billed_grams),
    base_freight_paise: Number(row.base_freight_paise),
    per_kg_freight_paise: Number(row.per_kg_freight_paise),
    last_mile_paise: Number(row.last_mile_paise),
    extra_tax_bps: Number(row.extra_tax_bps),
    other_fees_paise: Number(row.other_fees_paise),
    cod_allowed: Boolean(row.cod_allowed),
    cod_fee_paise: Number(row.cod_fee_paise),
    cod_max_total_paise:
      row.cod_max_total_paise !== null && row.cod_max_total_paise !== undefined
        ? Number(row.cod_max_total_paise)
        : null,
    freight_advance_allowed: Boolean(row.freight_advance_allowed),
    eta_label: String(row.eta_label),
    operator_name: row.operator_name ? String(row.operator_name) : null,
    starts_at: row.starts_at ? String(row.starts_at) : null,
    ends_at: row.ends_at ? String(row.ends_at) : null,
    created_at: String(row.created_at),
  };
}

export function listTradeLanes(activeOnly = false): TradeLaneRecord[] {
  const db = getDb();
  const sql = activeOnly
    ? "SELECT * FROM trade_lanes WHERE is_active = 1 ORDER BY lane_code ASC, version DESC"
    : "SELECT * FROM trade_lanes ORDER BY lane_code ASC, version DESC";
  const rows = db.prepare(sql).all() as Array<Record<string, unknown>>;
  return rows.map(mapLaneRow);
}

export function findMatchingTradeLanes(
  pin: string,
  serviceType: "bulk" | "trial"
): TradeLaneRecord[] {
  const nowIso = new Date().toISOString();
  const rows = getDb()
    .prepare(
      `
      SELECT * FROM trade_lanes
      WHERE is_active = 1
        AND pin_start <= ? AND pin_end >= ?
        AND (starts_at IS NULL OR starts_at <= ?)
        AND (ends_at IS NULL OR ends_at >= ?)
        AND ${
          serviceType === "trial"
            ? "service_code = 'trial_parcel'"
            : "service_code != 'trial_parcel'"
        }
      ORDER BY version DESC, base_freight_paise ASC
    `
    )
    .all(pin, pin, nowIso, nowIso) as Array<Record<string, unknown>>;
  return rows.map(mapLaneRow);
}

export function upsertTradeLane(raw: unknown): TradeLaneRecord {
  const input = TradeLaneUpsertSchema.parse(raw);
  if (input.pin_start > input.pin_end) {
    throw new Error("pin_start must be <= pin_end.");
  }
  const db = getDb();
  return db.transaction(() => {
    const maxVerRow = db
      .prepare(
        "SELECT COALESCE(MAX(version), 0) AS max_ver FROM trade_lanes WHERE lane_code = ?"
      )
      .get(input.lane_code) as { max_ver: number };
    const nextVersion = input.version ?? maxVerRow.max_ver + 1;
    const id = input.id || `lane-${input.lane_code.toLowerCase()}-v${nextVersion}-${randomUUID().slice(0, 6)}`;

    // If creating a new active version for the same lane_code, deactivate older active versions of the same lane_code
    if (input.is_active) {
      db.prepare(
        "UPDATE trade_lanes SET is_active = 0 WHERE lane_code = ? AND id != ?"
      ).run(input.lane_code, id);
    }

    db.prepare(`
      INSERT INTO trade_lanes (
        id, lane_code, version, is_active, origin_pin, pin_start, pin_end,
        service_code, service_label, handover_kind, locality_label,
        depot_name, depot_address, onward_included,
        billed_weight_rule, dim_divisor, billing_increment_grams, tare_grams,
        box_length_cm, box_width_cm, box_height_cm, max_net_grams, max_billed_grams,
        base_freight_paise, per_kg_freight_paise, last_mile_paise, extra_tax_bps, other_fees_paise,
        cod_allowed, cod_fee_paise, cod_max_total_paise, freight_advance_allowed,
        eta_label, operator_name, starts_at, ends_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        is_active = excluded.is_active,
        origin_pin = excluded.origin_pin,
        pin_start = excluded.pin_start,
        pin_end = excluded.pin_end,
        service_code = excluded.service_code,
        service_label = excluded.service_label,
        handover_kind = excluded.handover_kind,
        locality_label = excluded.locality_label,
        depot_name = excluded.depot_name,
        depot_address = excluded.depot_address,
        onward_included = excluded.onward_included,
        billed_weight_rule = excluded.billed_weight_rule,
        dim_divisor = excluded.dim_divisor,
        billing_increment_grams = excluded.billing_increment_grams,
        tare_grams = excluded.tare_grams,
        box_length_cm = excluded.box_length_cm,
        box_width_cm = excluded.box_width_cm,
        box_height_cm = excluded.box_height_cm,
        max_net_grams = excluded.max_net_grams,
        max_billed_grams = excluded.max_billed_grams,
        base_freight_paise = excluded.base_freight_paise,
        per_kg_freight_paise = excluded.per_kg_freight_paise,
        last_mile_paise = excluded.last_mile_paise,
        extra_tax_bps = excluded.extra_tax_bps,
        other_fees_paise = excluded.other_fees_paise,
        cod_allowed = excluded.cod_allowed,
        cod_fee_paise = excluded.cod_fee_paise,
        cod_max_total_paise = excluded.cod_max_total_paise,
        freight_advance_allowed = excluded.freight_advance_allowed,
        eta_label = excluded.eta_label,
        operator_name = excluded.operator_name,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at
    `).run(
      id,
      input.lane_code,
      nextVersion,
      input.is_active ? 1 : 0,
      input.origin_pin,
      input.pin_start,
      input.pin_end,
      input.service_code,
      input.service_label,
      input.handover_kind,
      input.locality_label,
      input.depot_name ?? null,
      input.depot_address ?? null,
      input.onward_included ? 1 : 0,
      input.billed_weight_rule,
      input.dim_divisor,
      input.billing_increment_grams,
      input.tare_grams,
      input.box_length_cm,
      input.box_width_cm,
      input.box_height_cm,
      input.max_net_grams,
      input.max_billed_grams,
      input.base_freight_paise,
      input.per_kg_freight_paise,
      input.last_mile_paise,
      input.extra_tax_bps,
      input.other_fees_paise,
      input.cod_allowed ? 1 : 0,
      input.cod_fee_paise,
      input.cod_max_total_paise ?? null,
      input.freight_advance_allowed ? 1 : 0,
      input.eta_label,
      input.operator_name ?? null,
      input.starts_at ?? null,
      input.ends_at ?? null
    );

    const saved = db
      .prepare("SELECT * FROM trade_lanes WHERE id = ?")
      .get(id) as Record<string, unknown>;
    return mapLaneRow(saved);
  })();
}

export function setTradeLaneActive(laneId: string, isActive: boolean): boolean {
  const res = getDb()
    .prepare("UPDATE trade_lanes SET is_active = ? WHERE id = ?")
    .run(isActive ? 1 : 0, laneId);
  return res.changes > 0;
}

export function listLocalizedContent(locale?: string): TradeLocalizedContentRecord[] {
  const db = getDb();
  const rows = locale
    ? (db
        .prepare(
          "SELECT * FROM trade_localized_content WHERE locale = ? ORDER BY resource_key ASC"
        )
        .all(locale) as Array<Record<string, unknown>>)
    : (db
        .prepare(
          "SELECT * FROM trade_localized_content ORDER BY locale ASC, resource_key ASC"
        )
        .all() as Array<Record<string, unknown>>);

  return rows.map((r) => ({
    id: Number(r.id),
    resource_key: String(r.resource_key),
    locale: String(r.locale) as AnyTradeLocale,
    source_revision: Number(r.source_revision),
    text_value: String(r.text_value),
    audio_url: r.audio_url ? String(r.audio_url) : null,
    transcript: r.transcript ? String(r.transcript) : null,
    review_status: String(r.review_status) as "draft" | "reviewed" | "needs_review",
    updated_by: r.updated_by ? String(r.updated_by) : null,
    updated_at: String(r.updated_at),
  }));
}

export function upsertLocalizedContent(raw: unknown): TradeLocalizedContentRecord {
  const input = TradeLocalizedContentUpsertSchema.parse(raw);
  const db = getDb();
  db.prepare(`
    INSERT INTO trade_localized_content (
      resource_key, locale, source_revision, text_value, audio_url, transcript,
      review_status, updated_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(resource_key, locale) DO UPDATE SET
      source_revision = excluded.source_revision,
      text_value = excluded.text_value,
      audio_url = excluded.audio_url,
      transcript = excluded.transcript,
      review_status = excluded.review_status,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    input.resource_key,
    input.locale,
    input.source_revision,
    input.text_value,
    input.audio_url ?? null,
    input.transcript ?? null,
    input.review_status,
    input.updated_by ?? null
  );
  const row = db
    .prepare(
      "SELECT * FROM trade_localized_content WHERE resource_key = ? AND locale = ?"
    )
    .get(input.resource_key, input.locale) as Record<string, unknown>;
  return {
    id: Number(row.id),
    resource_key: String(row.resource_key),
    locale: String(row.locale) as AnyTradeLocale,
    source_revision: Number(row.source_revision),
    text_value: String(row.text_value),
    audio_url: row.audio_url ? String(row.audio_url) : null,
    transcript: row.transcript ? String(row.transcript) : null,
    review_status: String(row.review_status) as "draft" | "reviewed" | "needs_review",
    updated_by: row.updated_by ? String(row.updated_by) : null,
    updated_at: String(row.updated_at),
  };
}

export function listTradeEnquiries(status?: string) {
  const db = getDb();
  if (status && status !== "all") {
    return db
      .prepare(
        "SELECT * FROM trade_enquiries WHERE status = ? ORDER BY created_at DESC LIMIT 200"
      )
      .all(status);
  }
  return db
    .prepare("SELECT * FROM trade_enquiries ORDER BY created_at DESC LIMIT 200")
    .all();
}

export function updateTradeEnquiry(raw: unknown) {
  const input = TradeEnquiryUpdateSchema.parse(raw);
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM trade_enquiries WHERE id = ?")
    .get(input.id) as Record<string, unknown> | undefined;
  if (!existing) throw new Error(`Enquiry ${input.id} not found.`);

  db.prepare(`
    UPDATE trade_enquiries
    SET status = ?, assigned_owner = ?, notes = ?, converted_quote_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    input.status ?? existing.status,
    input.assigned_owner !== undefined ? input.assigned_owner : existing.assigned_owner,
    input.notes !== undefined ? input.notes : existing.notes,
    input.converted_quote_id !== undefined
      ? input.converted_quote_id
      : existing.converted_quote_id,
    input.id
  );
  return db.prepare("SELECT * FROM trade_enquiries WHERE id = ?").get(input.id);
}

export function listTradeSharedPilots(activeOnly = false): TradeSharedPilotRecord[] {
  const db = getDb();
  const rows = (
    activeOnly
      ? db
          .prepare(
            "SELECT * FROM trade_shared_pilots WHERE status = 'active' ORDER BY cutoff_at ASC"
          )
          .all()
      : db
          .prepare("SELECT * FROM trade_shared_pilots ORDER BY created_at DESC")
          .all()
  ) as Array<Record<string, unknown>>;

  const records: TradeSharedPilotRecord[] = rows.map((r) => ({
    id: String(r.id),
    town_name: String(r.town_name),
    pin_prefix: String(r.pin_prefix),
    collection_point: String(r.collection_point),
    collection_address: String(r.collection_address),
    local_fee_paise: Number(r.local_fee_paise),
    cutoff_at: String(r.cutoff_at),
    dispatch_partner: String(r.dispatch_partner),
    dispatch_schedule: String(r.dispatch_schedule),
    target_kg: Number(r.target_kg),
    booked_kg: Number(r.booked_kg),
    status: String(r.status) as "active" | "paused" | "dispatched" | "cancelled",
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }));
  return activeOnly ? publicTradePilots(records) : records;
}

export function upsertTradeSharedPilot(raw: unknown): TradeSharedPilotRecord {
  const input = TradeSharedPilotUpsertSchema.parse(raw);
  const db = getDb();
  const id = input.id || `pilot-${randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO trade_shared_pilots (
      id, town_name, pin_prefix, collection_point, collection_address,
      local_fee_paise, cutoff_at, dispatch_partner, dispatch_schedule,
      target_kg, booked_kg, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      town_name = excluded.town_name,
      pin_prefix = excluded.pin_prefix,
      collection_point = excluded.collection_point,
      collection_address = excluded.collection_address,
      local_fee_paise = excluded.local_fee_paise,
      cutoff_at = excluded.cutoff_at,
      dispatch_partner = excluded.dispatch_partner,
      dispatch_schedule = excluded.dispatch_schedule,
      target_kg = excluded.target_kg,
      booked_kg = excluded.booked_kg,
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    id,
    input.town_name,
    input.pin_prefix,
    input.collection_point,
    input.collection_address,
    input.local_fee_paise,
    input.cutoff_at,
    input.dispatch_partner,
    input.dispatch_schedule,
    input.target_kg,
    input.booked_kg,
    input.status
  );
  const saved = db
    .prepare("SELECT * FROM trade_shared_pilots WHERE id = ?")
    .get(id) as Record<string, unknown>;
  return {
    id: String(saved.id),
    town_name: String(saved.town_name),
    pin_prefix: String(saved.pin_prefix),
    collection_point: String(saved.collection_point),
    collection_address: String(saved.collection_address),
    local_fee_paise: Number(saved.local_fee_paise),
    cutoff_at: String(saved.cutoff_at),
    dispatch_partner: String(saved.dispatch_partner),
    dispatch_schedule: String(saved.dispatch_schedule),
    target_kg: Number(saved.target_kg),
    booked_kg: Number(saved.booked_kg),
    status: String(saved.status) as "active" | "paused" | "dispatched" | "cancelled",
    created_at: String(saved.created_at),
    updated_at: String(saved.updated_at),
  };
}

export function listTradeOrdersAdmin() {
  return getDb()
    .prepare(
      `
      SELECT t.*, o.customer_name, o.customer_email, o.customer_phone,
             o.status AS order_status, o.payment_status, o.dispatch_status
      FROM trade_orders t
      JOIN orders o ON o.id = t.order_id
      ORDER BY t.created_at DESC
      LIMIT 200
    `
    )
    .all();
}

export function reconcileTradeOrder(raw: unknown) {
  const input = TradeOrderReconcileSchema.parse(raw);
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM trade_orders WHERE order_id = ?")
    .get(input.order_id) as Record<string, unknown> | undefined;
  if (!existing) throw new Error(`Trade order ${input.order_id} not found.`);

  db.transaction(() => {
    if (input.remittance_status !== undefined || input.remitted_paise !== undefined) {
      db.prepare(
        "UPDATE trade_orders SET remittance_status = ?, remitted_paise = ? WHERE order_id = ?"
      ).run(
        input.remittance_status ?? existing.remittance_status,
        input.remitted_paise ?? existing.remitted_paise,
        input.order_id
      );
    }
    if (input.dispatch_status) {
      db.prepare("UPDATE orders SET dispatch_status = ? WHERE id = ?").run(
        input.dispatch_status,
        input.order_id
      );
    }
  })();

  return db
    .prepare(
      "SELECT t.*, o.status AS order_status, o.payment_status, o.dispatch_status FROM trade_orders t JOIN orders o ON o.id = t.order_id WHERE t.order_id = ?"
    )
    .get(input.order_id);
}

export function getTradeFunnelSummary() {
  const db = getDb();
  const eventCounts = db
    .prepare(
      `
      SELECT event_name, COUNT(*) AS count, COALESCE(SUM(value_paise), 0) AS total_paise
      FROM trade_funnel_events
      GROUP BY event_name
    `
    )
    .all() as Array<{ event_name: string; count: number; total_paise: number }>;

  const quoteStats = db
    .prepare(
      "SELECT kind, COUNT(*) AS count FROM trade_quotes GROUP BY kind"
    )
    .all() as Array<{ kind: string; count: number }>;

  const enquiryStats = db
    .prepare(
      "SELECT status, COUNT(*) AS count FROM trade_enquiries GROUP BY status"
    )
    .all() as Array<{ status: string; count: number }>;

  return { eventCounts, quoteStats, enquiryStats };
}
