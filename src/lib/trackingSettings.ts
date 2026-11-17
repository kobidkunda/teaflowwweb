import { getDb } from "@/lib/db";

export type ConversionPlatform = "google_ads" | "meta" | "ga4";
export type ConversionDelivery = "admin_direct" | "gtm_datalayer" | "both";
export type ConversionTriggerEvent =
  | "purchase"
  | "generate_lead"
  | "begin_checkout"
  | "add_shipping_info"
  | "add_payment_info"
  | "add_to_cart"
  | "view_item"
  | "search";
export type ConversionValueMode = "order_total" | "merchandise_subtotal" | "fixed" | "none";

export interface ConversionRule {
  id: string;
  name: string;
  enabled: boolean;
  platform: ConversionPlatform;
  delivery: ConversionDelivery;
  trigger_event: ConversionTriggerEvent;
  lead_type_filter?: string;
  ads_conversion_id?: string;
  ads_conversion_label?: string;
  meta_pixel_id?: string;
  meta_event_name?: string;
  meta_is_custom_event?: boolean;
  custom_event_name?: string;
  value_mode: ConversionValueMode;
  fixed_value?: number;
  currency?: string;
  paid_only?: boolean;
}

export interface TrackingSettings {
  gtm_container_id: string;
  gtm_enabled: boolean;
  ga4_measurement_id: string;
  ga4_enabled: boolean;
  ga4_run_alongside_gtm: boolean;
  meta_pixel_id: string;
  meta_pixel_enabled: boolean;
  meta_run_alongside_gtm: boolean;
  google_ads_id: string;
  google_ads_enabled: boolean;
  conversion_rules: ConversionRule[];
  custom_head_script: string;
  custom_body_script: string;
}

export interface PublicTrackingConfig {
  gtmContainerId: string;
  gtmEnabled: boolean;
  ga4MeasurementId: string;
  ga4Enabled: boolean;
  ga4RunAlongsideGtm: boolean;
  metaPixelId: string;
  metaPixelEnabled: boolean;
  metaRunAlongsideGtm: boolean;
  googleAdsId: string;
  googleAdsEnabled: boolean;
  conversionRules: ConversionRule[];
  customHeadScript: string;
  customBodyScript: string;
}

export interface UpdateTrackingSettingsInput {
  gtm_container_id?: string;
  gtm_enabled?: boolean;
  ga4_measurement_id?: string;
  ga4_enabled?: boolean;
  ga4_run_alongside_gtm?: boolean;
  meta_pixel_id?: string;
  meta_pixel_enabled?: boolean;
  meta_run_alongside_gtm?: boolean;
  google_ads_id?: string;
  google_ads_enabled?: boolean;
  conversion_rules?: ConversionRule[];
  custom_head_script?: string;
  custom_body_script?: string;
}

const DEFAULT_GTM_CONTAINER_ID = "GTM-M5G27HSQ";
const TRACKING_SETTING_KEYS = [
  "gtm_container_id",
  "gtm_enabled",
  "ga4_measurement_id",
  "ga4_enabled",
  "ga4_run_alongside_gtm",
  "meta_pixel_id",
  "meta_pixel_enabled",
  "meta_run_alongside_gtm",
  "google_ads_id",
  "google_ads_enabled",
  "tracking_conversion_rules",
  "custom_head_script",
  "custom_body_script",
] as const;

const VALID_PLATFORMS = new Set<ConversionPlatform>(["google_ads", "meta", "ga4"]);
const VALID_DELIVERIES = new Set<ConversionDelivery>(["admin_direct", "gtm_datalayer", "both"]);
const VALID_EVENTS = new Set<ConversionTriggerEvent>([
  "purchase",
  "generate_lead",
  "begin_checkout",
  "add_shipping_info",
  "add_payment_info",
  "add_to_cart",
  "view_item",
  "search",
]);
const VALID_VALUE_MODES = new Set<ConversionValueMode>([
  "order_total",
  "merchandise_subtotal",
  "fixed",
  "none",
]);

function normalizeConversionRules(input: unknown): ConversionRule[] {
  if (!Array.isArray(input)) return [];
  const rules: ConversionRule[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim().slice(0, 64) : "";
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 120) : "";
    if (!id || !name) continue;
    const platform = VALID_PLATFORMS.has(item.platform as ConversionPlatform)
      ? (item.platform as ConversionPlatform)
      : "google_ads";
    const delivery = VALID_DELIVERIES.has(item.delivery as ConversionDelivery)
      ? (item.delivery as ConversionDelivery)
      : "admin_direct";
    const trigger_event = VALID_EVENTS.has(item.trigger_event as ConversionTriggerEvent)
      ? (item.trigger_event as ConversionTriggerEvent)
      : "purchase";
    const value_mode = VALID_VALUE_MODES.has(item.value_mode as ConversionValueMode)
      ? (item.value_mode as ConversionValueMode)
      : "order_total";

    const fixedValue =
      typeof item.fixed_value === "number" && Number.isFinite(item.fixed_value) && item.fixed_value >= 0
        ? Number(item.fixed_value)
        : undefined;

    rules.push({
      id,
      name,
      enabled: Boolean(item.enabled),
      platform,
      delivery,
      trigger_event,
      ...(typeof item.lead_type_filter === "string" && item.lead_type_filter.trim()
        ? { lead_type_filter: item.lead_type_filter.trim().slice(0, 80) }
        : {}),
      ...(typeof item.ads_conversion_id === "string" && item.ads_conversion_id.trim()
        ? { ads_conversion_id: item.ads_conversion_id.trim().toUpperCase().slice(0, 32) }
        : {}),
      ...(typeof item.ads_conversion_label === "string" && item.ads_conversion_label.trim()
        ? { ads_conversion_label: item.ads_conversion_label.trim().slice(0, 64) }
        : {}),
      ...(typeof item.meta_pixel_id === "string" && item.meta_pixel_id.trim()
        ? { meta_pixel_id: item.meta_pixel_id.trim().slice(0, 32) }
        : {}),
      ...(typeof item.meta_event_name === "string" && item.meta_event_name.trim()
        ? { meta_event_name: item.meta_event_name.trim().slice(0, 64) }
        : {}),
      ...(item.meta_is_custom_event !== undefined
        ? { meta_is_custom_event: Boolean(item.meta_is_custom_event) }
        : {}),
      ...(typeof item.custom_event_name === "string" && item.custom_event_name.trim()
        ? { custom_event_name: item.custom_event_name.trim().slice(0, 64) }
        : {}),
      value_mode,
      ...(fixedValue !== undefined ? { fixed_value: fixedValue } : {}),
      ...(typeof item.currency === "string" && item.currency.trim()
        ? { currency: item.currency.trim().toUpperCase().slice(0, 8) }
        : {}),
      ...(item.paid_only !== undefined ? { paid_only: Boolean(item.paid_only) } : {}),
    });
    if (rules.length >= 50) break;
  }
  return rules;
}

function parseConversionRules(raw: string | undefined): ConversionRule[] {
  if (!raw) return [];
  try {
    return normalizeConversionRules(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function getTrackingSettings(): TrackingSettings {
  try {
    const db = getDb();
    const placeholders = TRACKING_SETTING_KEYS.map(() => "?").join(", ");
    const rows = db
      .prepare(`SELECT key, value FROM store_settings WHERE key IN (${placeholders})`)
      .all(...TRACKING_SETTING_KEYS) as Array<{ key: string; value: string }>;

    const map = new Map(rows.map((r) => [r.key, r.value]));

    const gtmContainerId = (map.get("gtm_container_id") ?? DEFAULT_GTM_CONTAINER_ID).trim();
    const gtmEnabled = map.get("gtm_enabled") !== "0"; // Enabled by default unless explicitly disabled

    const ga4MeasurementId = (map.get("ga4_measurement_id") ?? "").trim();
    const ga4Enabled = map.get("ga4_enabled") === "1";
    const ga4RunAlongsideGtm = map.get("ga4_run_alongside_gtm") === "1";

    const metaPixelId = (map.get("meta_pixel_id") ?? "").trim();
    const metaPixelEnabled = map.get("meta_pixel_enabled") === "1";
    const metaRunAlongsideGtm = map.get("meta_run_alongside_gtm") === "1";

    const googleAdsId = (map.get("google_ads_id") ?? "").trim().toUpperCase();
    const googleAdsEnabled = map.get("google_ads_enabled") === "1";

    const conversionRules = parseConversionRules(map.get("tracking_conversion_rules"));

    const customHeadScript = map.get("custom_head_script") ?? "";
    const customBodyScript = map.get("custom_body_script") ?? "";

    return {
      gtm_container_id: gtmContainerId || DEFAULT_GTM_CONTAINER_ID,
      gtm_enabled: gtmEnabled,
      ga4_measurement_id: ga4MeasurementId,
      ga4_enabled: ga4Enabled,
      ga4_run_alongside_gtm: ga4RunAlongsideGtm,
      meta_pixel_id: metaPixelId,
      meta_pixel_enabled: metaPixelEnabled,
      meta_run_alongside_gtm: metaRunAlongsideGtm,
      google_ads_id: googleAdsId,
      google_ads_enabled: googleAdsEnabled,
      conversion_rules: conversionRules,
      custom_head_script: customHeadScript,
      custom_body_script: customBodyScript,
    };
  } catch {
    // Graceful fallback during bootstrap or if database table is unavailable
    return {
      gtm_container_id: DEFAULT_GTM_CONTAINER_ID,
      gtm_enabled: true,
      ga4_measurement_id: "",
      ga4_enabled: false,
      ga4_run_alongside_gtm: false,
      meta_pixel_id: "",
      meta_pixel_enabled: false,
      meta_run_alongside_gtm: false,
      google_ads_id: "",
      google_ads_enabled: false,
      conversion_rules: [],
      custom_head_script: "",
      custom_body_script: "",
    };
  }
}

export function updateTrackingSettings(input: UpdateTrackingSettingsInput): TrackingSettings {
  const db = getDb();
  const current = getTrackingSettings();

  const gtmContainerId = (input.gtm_container_id ?? current.gtm_container_id).trim();
  const gtmEnabled = input.gtm_enabled !== undefined ? (input.gtm_enabled ? "1" : "0") : current.gtm_enabled ? "1" : "0";

  const ga4MeasurementId = (input.ga4_measurement_id ?? current.ga4_measurement_id).trim();
  const ga4Enabled = input.ga4_enabled !== undefined ? (input.ga4_enabled ? "1" : "0") : current.ga4_enabled ? "1" : "0";
  const ga4RunAlongsideGtm =
    input.ga4_run_alongside_gtm !== undefined
      ? input.ga4_run_alongside_gtm
        ? "1"
        : "0"
      : current.ga4_run_alongside_gtm
        ? "1"
        : "0";

  const metaPixelId = (input.meta_pixel_id ?? current.meta_pixel_id).trim();
  const metaPixelEnabled = input.meta_pixel_enabled !== undefined ? (input.meta_pixel_enabled ? "1" : "0") : current.meta_pixel_enabled ? "1" : "0";
  const metaRunAlongsideGtm =
    input.meta_run_alongside_gtm !== undefined
      ? input.meta_run_alongside_gtm
        ? "1"
        : "0"
      : current.meta_run_alongside_gtm
        ? "1"
        : "0";

  const googleAdsId = (input.google_ads_id ?? current.google_ads_id).trim().toUpperCase();
  const googleAdsEnabled =
    input.google_ads_enabled !== undefined
      ? input.google_ads_enabled
        ? "1"
        : "0"
      : current.google_ads_enabled
        ? "1"
        : "0";

  const conversionRules = normalizeConversionRules(
    input.conversion_rules !== undefined ? input.conversion_rules : current.conversion_rules
  );

  const customHeadScript = input.custom_head_script ?? current.custom_head_script;
  const customBodyScript = input.custom_body_script ?? current.custom_body_script;

  const upsertStmt = db.prepare(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    upsertStmt.run("gtm_container_id", gtmContainerId);
    upsertStmt.run("gtm_enabled", gtmEnabled);
    upsertStmt.run("ga4_measurement_id", ga4MeasurementId);
    upsertStmt.run("ga4_enabled", ga4Enabled);
    upsertStmt.run("ga4_run_alongside_gtm", ga4RunAlongsideGtm);
    upsertStmt.run("meta_pixel_id", metaPixelId);
    upsertStmt.run("meta_pixel_enabled", metaPixelEnabled);
    upsertStmt.run("meta_run_alongside_gtm", metaRunAlongsideGtm);
    upsertStmt.run("google_ads_id", googleAdsId);
    upsertStmt.run("google_ads_enabled", googleAdsEnabled);
    upsertStmt.run("tracking_conversion_rules", JSON.stringify(conversionRules));
    upsertStmt.run("custom_head_script", customHeadScript);
    upsertStmt.run("custom_body_script", customBodyScript);
  })();

  return getTrackingSettings();
}

export function getPublicTrackingConfig(): PublicTrackingConfig {
  const settings = getTrackingSettings();
  return {
    gtmContainerId: settings.gtm_enabled ? settings.gtm_container_id : "",
    gtmEnabled: settings.gtm_enabled,
    ga4MeasurementId: settings.ga4_enabled ? settings.ga4_measurement_id : "",
    ga4Enabled: settings.ga4_enabled,
    ga4RunAlongsideGtm: settings.ga4_run_alongside_gtm,
    metaPixelId: settings.meta_pixel_enabled ? settings.meta_pixel_id : "",
    metaPixelEnabled: settings.meta_pixel_enabled,
    metaRunAlongsideGtm: settings.meta_run_alongside_gtm,
    googleAdsId: settings.google_ads_enabled ? settings.google_ads_id : "",
    googleAdsEnabled: settings.google_ads_enabled,
    conversionRules: settings.conversion_rules.filter((r) => r.enabled),
    customHeadScript: settings.custom_head_script,
    customBodyScript: settings.custom_body_script,
  };
}
