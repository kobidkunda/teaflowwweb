import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "@/lib/db";
import {
  getDeliverySettings,
  updateDeliverySettings,
  validateDeliveryOrder,
  validateCodEligibility,
} from "@/lib/deliverySettings";

describe("Unified Delivery & COD Settings", () => {
  beforeEach(() => {
    const db = getDb();
    // Clean and reset delivery keys
    db.prepare("DELETE FROM store_settings WHERE key LIKE '%shipping%' OR key LIKE '%cod%' OR key LIKE '%delivery%'").run();
  });

  it("returns authoritative default values for delivery and COD", () => {
    const settings = getDeliverySettings();

    expect(settings.shipping_flat_fee_rupees).toBe(99);
    expect(settings.shipping_flat_fee_paise).toBe(9900);
    expect(settings.free_shipping_threshold_rupees).toBe(599);
    expect(settings.free_shipping_threshold_paise).toBe(59900);
    expect(settings.free_shipping_enabled).toBe(true);
    expect(settings.min_delivery_order_rupees).toBe(0);
    expect(settings.min_delivery_order_paise).toBe(0);

    expect(settings.cod_enabled).toBe(true);
    expect(settings.cod_fee_rupees).toBe(50);
    expect(settings.cod_fee_paise).toBe(5000);
    expect(settings.cod_min_rupees).toBe(100);
    expect(settings.cod_min_paise).toBe(10000);
    expect(settings.cod_max_rupees).toBe(5000);
    expect(settings.cod_max_paise).toBe(500000);
  });

  it("updates delivery and COD settings atomically and syncs to commerce_markets", () => {
    const db = getDb();
    // Ensure commerce_markets IN exists
    db.prepare(`
      INSERT INTO commerce_markets (code, document, version)
      VALUES ('IN', '{"code":"IN","shipping":"flat","flatPaise":9900,"freeAbovePaise":59900,"cod":{"enabled":true,"feePaise":5000,"minPaise":10000,"maxPaise":500000,"postcodes":[],"blockedSkus":[]}}', 1)
      ON CONFLICT(code) DO NOTHING
    `).run();

    const updated = updateDeliverySettings({
      min_delivery_order_rupees: 250,
      shipping_flat_fee_rupees: 79,
      free_shipping_threshold_rupees: 699,
      free_shipping_enabled: true,
      shipping_calculation_mode: "flat",
      dispatch_commitment: "Same-day dispatch from Siliguri hub",
      announcement_auto_sync: true,
      cod_enabled: true,
      cod_fee_rupees: 40,
      cod_min_rupees: 150,
      cod_max_rupees: 4000,
      cod_postcodes: ["734001", "700001"],
      cod_blocked_skus: ["GIFT-CARD"],
      shiprocket_mode: "test",
      shiprocket_order_creation_mode: "manual",
      shiprocket_enabled: true,
      shiprocket_pickup_location: "Primary",
      shiprocket_pickup_postcode: "734015",
      shiprocket_default_length: 10,
      shiprocket_default_breadth: 10,
      shiprocket_default_height: 10,
      shiprocket_default_tare_grams: 100,
      shiprocket_default_hsn: "090230",
    });

    expect(updated.min_delivery_order_rupees).toBe(250);
    expect(updated.min_delivery_order_paise).toBe(25000);
    expect(updated.shipping_flat_fee_rupees).toBe(79);
    expect(updated.shipping_flat_fee_paise).toBe(7900);
    expect(updated.free_shipping_threshold_rupees).toBe(699);
    expect(updated.free_shipping_threshold_paise).toBe(69900);
    expect(updated.cod_fee_rupees).toBe(40);
    expect(updated.cod_min_rupees).toBe(150);
    expect(updated.cod_max_rupees).toBe(4000);
    expect(updated.cod_postcodes).toEqual(["734001", "700001"]);

    // Verify commerce_markets document sync
    const inRow = db.prepare("SELECT document FROM commerce_markets WHERE code = 'IN'").get() as { document: string };
    const doc = JSON.parse(inRow.document);
    expect(doc.flatPaise).toBe(7900);
    expect(doc.freeAbovePaise).toBe(69900);
    expect(doc.cod.feePaise).toBe(4000);
    expect(doc.cod.minPaise).toBe(15000);
    expect(doc.cod.maxPaise).toBe(400000);
    expect(doc.cod.postcodes).toEqual(["734001", "700001"]);
  });

  it("validates minimum delivery order thresholds correctly", () => {
    const settings = {
      ...getDeliverySettings(),
      min_delivery_order_rupees: 300,
      min_delivery_order_paise: 30000,
    };

    // Subtotal below minimum
    const below = validateDeliveryOrder(18000, settings);
    expect(below.eligible).toBe(false);
    expect(below.remainingRupees).toBe(120);
    expect(below.message).toContain("Minimum order for delivery is ₹300");

    // Subtotal meeting minimum
    const exact = validateDeliveryOrder(30000, settings);
    expect(exact.eligible).toBe(true);
    expect(exact.remainingRupees).toBe(0);

    // Subtotal exceeding minimum
    const above = validateDeliveryOrder(55000, settings);
    expect(above.eligible).toBe(true);
  });

  it("validates Cash on Delivery eligibility across enabled status, amount boundaries, and pin codes", () => {
    const settings = {
      ...getDeliverySettings(),
      cod_enabled: true,
      cod_min_rupees: 100,
      cod_min_paise: 10000,
      cod_max_rupees: 3000,
      cod_max_paise: 300000,
      cod_postcodes: ["700001", "734001"],
      cod_blocked_skus: ["BLOCK-SKU"],
    };

    // Order below COD min
    const belowMin = validateCodEligibility(5000, "700001", [], settings);
    expect(belowMin.eligible).toBe(false);
    expect(belowMin.reason).toContain("minimum order of ₹100");

    // Order above COD max
    const aboveMax = validateCodEligibility(350000, "700001", [], settings);
    expect(aboveMax.eligible).toBe(false);
    expect(aboveMax.reason).toContain("orders up to ₹3000");

    // Unserviceable PIN code
    const invalidPin = validateCodEligibility(15000, "110001", [], settings);
    expect(invalidPin.eligible).toBe(false);
    expect(invalidPin.reason).toContain("PIN code 110001");

    // Blocked SKU
    const blockedSku = validateCodEligibility(15000, "700001", ["BLOCK-SKU"], settings);
    expect(blockedSku.eligible).toBe(false);

    // Valid order
    const valid = validateCodEligibility(15000, "700001", ["SAFE-TEA"], settings);
    expect(valid.eligible).toBe(true);

    // Disabled COD
    const disabled = validateCodEligibility(15000, "700001", [], { ...settings, cod_enabled: false });
    expect(disabled.eligible).toBe(false);
    expect(disabled.reason).toContain("currently disabled");
  });
});
