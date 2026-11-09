import { getDb } from "@/lib/db";

export interface TrackingSettings {
  gtm_container_id: string;
  gtm_enabled: boolean;
  ga4_measurement_id: string;
  ga4_enabled: boolean;
  meta_pixel_id: string;
  meta_pixel_enabled: boolean;
  custom_head_script: string;
  custom_body_script: string;
}

export interface PublicTrackingConfig {
  gtmContainerId: string;
  gtmEnabled: boolean;
  ga4MeasurementId: string;
  ga4Enabled: boolean;
  metaPixelId: string;
  metaPixelEnabled: boolean;
  customHeadScript: string;
  customBodyScript: string;
}

export interface UpdateTrackingSettingsInput {
  gtm_container_id?: string;
  gtm_enabled?: boolean;
  ga4_measurement_id?: string;
  ga4_enabled?: boolean;
  meta_pixel_id?: string;
  meta_pixel_enabled?: boolean;
  custom_head_script?: string;
  custom_body_script?: string;
}

const DEFAULT_GTM_CONTAINER_ID = "GTM-M5G27HSQ";

export function getTrackingSettings(): TrackingSettings {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT key, value FROM store_settings WHERE key IN ('gtm_container_id', 'gtm_enabled', 'ga4_measurement_id', 'ga4_enabled', 'meta_pixel_id', 'meta_pixel_enabled', 'custom_head_script', 'custom_body_script')"
      )
      .all() as Array<{ key: string; value: string }>;

    const map = new Map(rows.map((r) => [r.key, r.value]));

    const gtmContainerId = (map.get("gtm_container_id") ?? DEFAULT_GTM_CONTAINER_ID).trim();
    const gtmEnabled = map.get("gtm_enabled") !== "0"; // Enabled by default unless explicitly disabled

    const ga4MeasurementId = (map.get("ga4_measurement_id") ?? "").trim();
    const ga4Enabled = map.get("ga4_enabled") === "1";

    const metaPixelId = (map.get("meta_pixel_id") ?? "").trim();
    const metaPixelEnabled = map.get("meta_pixel_enabled") === "1";

    const customHeadScript = map.get("custom_head_script") ?? "";
    const customBodyScript = map.get("custom_body_script") ?? "";

    return {
      gtm_container_id: gtmContainerId || DEFAULT_GTM_CONTAINER_ID,
      gtm_enabled: gtmEnabled,
      ga4_measurement_id: ga4MeasurementId,
      ga4_enabled: ga4Enabled,
      meta_pixel_id: metaPixelId,
      meta_pixel_enabled: metaPixelEnabled,
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
      meta_pixel_id: "",
      meta_pixel_enabled: false,
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

  const metaPixelId = (input.meta_pixel_id ?? current.meta_pixel_id).trim();
  const metaPixelEnabled = input.meta_pixel_enabled !== undefined ? (input.meta_pixel_enabled ? "1" : "0") : current.meta_pixel_enabled ? "1" : "0";

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
    upsertStmt.run("meta_pixel_id", metaPixelId);
    upsertStmt.run("meta_pixel_enabled", metaPixelEnabled);
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
    metaPixelId: settings.meta_pixel_enabled ? settings.meta_pixel_id : "",
    metaPixelEnabled: settings.meta_pixel_enabled,
    customHeadScript: settings.custom_head_script,
    customBodyScript: settings.custom_body_script,
  };
}
