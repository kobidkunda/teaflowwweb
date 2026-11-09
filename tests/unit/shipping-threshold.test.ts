import { describe, it, expect, beforeEach } from "vitest";
import { getShippingSettings, updateShippingSettings } from "@/lib/shippingSettings";
import { getPaymentSettings, updatePaymentSettings } from "@/lib/paymentSettings";
import { getDb } from "@/lib/db";

describe("Shipping & Payment Settings with Free Delivery Threshold", () => {
  beforeEach(() => {
    // Reset test database defaults
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value) VALUES ('free_shipping_threshold_paise', '59900')").run();
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value) VALUES ('shipping_flat_fee_paise', '9900')").run();
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value) VALUES ('shipping_calculation_mode', 'flat')").run();
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value) VALUES ('shiprocket_enabled', '1')").run();
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value) VALUES ('announcement_auto_sync', '1')").run();
  });

  it("reads default free delivery threshold as ₹599 (59900 paise)", () => {
    const s = getShippingSettings();
    expect(s.free_shipping_threshold_rupees).toBe(599);
    expect(s.free_shipping_threshold_paise).toBe(59900);
    expect(s.shipping_flat_fee_rupees).toBe(99);
    expect(s.free_shipping_enabled).toBe(true);
  });

  it("updates shipping threshold to ₹799 and syncs commerce_markets and announcement banner", () => {
    const updated = updateShippingSettings({
      free_shipping_threshold_rupees: 799,
      free_shipping_enabled: true,
      shipping_flat_fee_rupees: 149,
      shipping_calculation_mode: "flat",
      dispatch_commitment: "Same-day dispatch from Siliguri",
      announcement_auto_sync: true,
      shiprocket_enabled: true,
      shiprocket_email: "logistics@teafloww.com",
      shiprocket_pickup_location: "Siliguri Main Hub",
      shiprocket_pickup_postcode: "734015",
      shiprocket_default_length: 12,
      shiprocket_default_breadth: 12,
      shiprocket_default_height: 12,
      shiprocket_default_tare_grams: 120,
      shiprocket_default_hsn: "090230",
    });

    expect(updated.free_shipping_threshold_rupees).toBe(799);
    expect(updated.free_shipping_threshold_paise).toBe(79900);
    expect(updated.shipping_flat_fee_rupees).toBe(149);

    // Verify persisted in store_settings
    const db = getDb();
    const thresholdRow = db.prepare("SELECT value FROM store_settings WHERE key='free_shipping_threshold_paise'").get() as { value: string };
    expect(thresholdRow.value).toBe("79900");

    const flatRow = db.prepare("SELECT value FROM store_settings WHERE key='shipping_flat_fee_paise'").get() as { value: string };
    expect(flatRow.value).toBe("14900");

    const announcementRow = db.prepare("SELECT value FROM store_settings WHERE key='announcement_text'").get() as { value: string };
    expect(announcementRow.value).toContain("799");

    // Verify synced into commerce_markets for 'IN'
    const inRow = db.prepare("SELECT document FROM commerce_markets WHERE code='IN'").get() as { document: string } | undefined;
    if (inRow) {
      const doc = JSON.parse(inRow.document);
      expect(doc.freeAbovePaise).toBe(79900);
      expect(doc.flatPaise).toBe(14900);
    }
  });

  it("manages payment settings and masks sensitive credentials", () => {
    updatePaymentSettings({
      razorpay_enabled: true,
      razorpay_key_id: "rzp_test_1234567890",
      razorpay_key_secret: "super_secret_key_abc",
      razorpay_webhook_secret: "webhook_secret_xyz",
      cod_enabled: true,
      cod_fee_rupees: 50,
      cod_min_rupees: 100,
      cod_max_rupees: 5000,
    });

    const p = getPaymentSettings("http://localhost:3000");
    expect(p.razorpay_enabled).toBe(true);
    expect(p.razorpay_key_id).toBe("rzp_test_1234567890");
    expect(p.razorpay_key_secret).toBe("••••••••••••");
    expect(p.razorpay_webhook_secret).toBe("••••••••••••");
    expect(p.razorpay_secret_configured).toBe(true);
    expect(p.cod_enabled).toBe(true);
    expect(p.cod_fee_rupees).toBe(50);
    expect(p.cod_min_rupees).toBe(100);
    expect(p.cod_max_rupees).toBe(5000);
  });
});
