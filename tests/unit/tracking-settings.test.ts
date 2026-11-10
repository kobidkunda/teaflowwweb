import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, type TestEnv } from "./admin-e2e/test-helper";
import {
  getTrackingSettings,
  updateTrackingSettings,
  getPublicTrackingConfig,
} from "@/lib/trackingSettings";

describe("Tracking & Analytics Settings (GTM, Meta, GA4)", () => {
  let env: TestEnv;
  beforeAll(() => { env = setupAdminTestEnv(); });
  afterAll(() => env.cleanup());
  beforeEach(() => {
    // Reset to defaults
    updateTrackingSettings({
      gtm_container_id: "GTM-M5G27HSQ",
      gtm_enabled: true,
      ga4_measurement_id: "",
      ga4_enabled: false,
      meta_pixel_id: "",
      meta_pixel_enabled: false,
      custom_head_script: "",
      custom_body_script: "",
    });
  });

  it("retrieves default GTM container ID and enabled status", () => {
    const settings = getTrackingSettings();
    expect(settings.gtm_container_id).toBe("GTM-M5G27HSQ");
    expect(settings.gtm_enabled).toBe(true);
    expect(settings.ga4_enabled).toBe(false);
    expect(settings.meta_pixel_enabled).toBe(false);
  });

  it("updates and persists GTM, GA4 and Meta Pixel configurations in the database", () => {
    const updated = updateTrackingSettings({
      gtm_container_id: "GTM-ABC1234",
      gtm_enabled: true,
      ga4_measurement_id: "G-XYZ9876543",
      ga4_enabled: true,
      meta_pixel_id: "987654321012345",
      meta_pixel_enabled: true,
      custom_head_script: "<!-- test clarity script -->",
      custom_body_script: "<!-- test noscript -->",
    });

    expect(updated.gtm_container_id).toBe("GTM-ABC1234");
    expect(updated.gtm_enabled).toBe(true);
    expect(updated.ga4_measurement_id).toBe("G-XYZ9876543");
    expect(updated.ga4_enabled).toBe(true);
    expect(updated.meta_pixel_id).toBe("987654321012345");
    expect(updated.meta_pixel_enabled).toBe(true);
    expect(updated.custom_head_script).toBe("<!-- test clarity script -->");

    // Re-query independently
    const reloaded = getTrackingSettings();
    expect(reloaded.gtm_container_id).toBe("GTM-ABC1234");
    expect(reloaded.ga4_measurement_id).toBe("G-XYZ9876543");
    expect(reloaded.meta_pixel_id).toBe("987654321012345");
  });

  it("exports a sanitized public tracking config for storefront rendering", () => {
    updateTrackingSettings({
      gtm_container_id: "GTM-M5G27HSQ",
      gtm_enabled: true,
      ga4_measurement_id: "G-TEST123456",
      ga4_enabled: true,
      meta_pixel_id: "123456789",
      meta_pixel_enabled: true,
    });

    const pub = getPublicTrackingConfig();
    expect(pub.gtmContainerId).toBe("GTM-M5G27HSQ");
    expect(pub.gtmEnabled).toBe(true);
    expect(pub.ga4MeasurementId).toBe("G-TEST123456");
    expect(pub.ga4Enabled).toBe(true);
    expect(pub.metaPixelId).toBe("123456789");
    expect(pub.metaPixelEnabled).toBe(true);
  });

  it("omits container IDs in public config when service is disabled", () => {
    updateTrackingSettings({
      gtm_container_id: "GTM-M5G27HSQ",
      gtm_enabled: false,
      ga4_measurement_id: "G-TEST123456",
      ga4_enabled: false,
      meta_pixel_id: "123456789",
      meta_pixel_enabled: false,
    });

    const pub = getPublicTrackingConfig();
    expect(pub.gtmEnabled).toBe(false);
    expect(pub.gtmContainerId).toBe("");
    expect(pub.ga4Enabled).toBe(false);
    expect(pub.ga4MeasurementId).toBe("");
    expect(pub.metaPixelEnabled).toBe(false);
    expect(pub.metaPixelId).toBe("");
  });
});
