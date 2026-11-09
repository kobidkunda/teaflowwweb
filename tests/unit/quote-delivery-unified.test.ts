process.env.INTERNATIONAL_RATE_URL = "https://shipping.example.invalid/rate";
process.env.INTERNATIONAL_BOOKING_URL = "https://shipping.example.invalid/book";
process.env.LANDED_COST_URL = "https://shipping.example.invalid/landed";
process.env.COMMERCE_WORKER_SECRET = "isolated-worker-test-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";

import { beforeAll, describe, expect, it, vi } from "vitest";
import { setupAdminTestEnv, type TestEnv } from "./admin-e2e/test-helper";
import { packageSchema } from "@/lib/international/models";
import { markets, saveMarket, saveConfig } from "@/lib/international/store";
import { createQuote } from "@/lib/international/quotes";
import { updateDeliverySettings } from "@/lib/deliverySettings";
import { upsertProduct } from "@/lib/products";
import { productSchema, normalizeProductInput } from "@/lib/validation";

describe("Unified Delivery Rules & Minimum Delivery Order in Quotes", () => {
  let env: TestEnv;
  let variantId: number;

  beforeAll(() => {
    env = setupAdminTestEnv();
    Object.assign(process.env, {
      RAZORPAY_KEY_ID: "rzp_test_local",
      RAZORPAY_KEY_SECRET: "test_secret",
      RAZORPAY_WEBHOOK_SECRET: "test_webhook_secret",
      SHIPROCKET_EMAIL: "test@example.invalid",
      SHIPROCKET_PASSWORD: "test_password",
    });

    saveConfig(
      "package",
      packageSchema.parse({
        pickupPostcode: "734015",
        pickupLocation: "Siliguri Hub",
        length: 20,
        breadth: 15,
        height: 10,
        tareGrams: 100,
        maxGrams: 5000,
        hsn: "090230",
        origin: "IN",
      })
    );

    const m = markets().find((m) => m.code === "IN")!;
    const { version: _, ...india } = m;
    saveMarket(
      {
        ...india,
        enabled: true,
        covered: true,
        taxApproved: true,
        taxPercent: 0,
        taxInclusive: true,
      },
      "test-admin"
    );

    const prod = upsertProduct(
      productSchema.parse(
        normalizeProductInput({
          name: "Singbulli First Flush",
          slug: "singbulli-first-flush-delivery-test",
          status: "published",
        })
      )
    );
    variantId = Number(
      env.db
        .prepare("INSERT INTO variants (product_id,sku,grams,price_paise,stock) VALUES (?,?,?,?,?)")
        .run(prod.id, "SFF-DEL-100", 100, 20000, 50).lastInsertRowid
    );
  });

  it("enforces minimum delivery order when cart subtotal is below the threshold", async () => {
    updateDeliverySettings({
      min_delivery_order_rupees: 350,
      shipping_flat_fee_rupees: 80,
      free_shipping_threshold_rupees: 700,
      free_shipping_enabled: true,
      shipping_calculation_mode: "flat",
      dispatch_commitment: "Siliguri hub",
      announcement_auto_sync: false,
      cod_enabled: true,
      cod_fee_rupees: 50,
      cod_min_rupees: 100,
      cod_max_rupees: 5000,
      cod_postcodes: [],
      cod_blocked_skus: [],
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

    const providers = await import("@/lib/international/providers");
    vi.spyOn(providers, "shippingRate").mockResolvedValue({
      id: "std-rate",
      costPaise: 8000,
      expires: Date.now() + 15 * 60000,
      cod: true,
      ddp: false,
      dutiesPaise: 0,
    });

    // 1 item = ₹200 < ₹350 min delivery order -> rejected!
    await expect(
      createQuote(
        {
          address: {
            name: "Rahul Roy",
            email: "rahul@example.com",
            phone: "+91 9876543210",
            line1: "Station Feeder Road",
            city: "Siliguri",
            state: "West Bengal",
            postcode: "734001",
            country: "IN",
          },
          currency: "INR",
          locale: "en",
          method: "upi",
          items: [{ variantId, quantity: 1 }],
        },
        "session-min-order"
      )
    ).rejects.toThrow("Minimum order for delivery is ₹350. Please add ₹150 more to your bag.");

    // 2 items = ₹400 >= ₹350 min delivery order -> allowed!
    const quote = await createQuote(
      {
        address: {
          name: "Rahul Roy",
          email: "rahul@example.com",
          phone: "+91 9876543210",
          line1: "Station Feeder Road",
          city: "Siliguri",
          state: "West Bengal",
          postcode: "734001",
          country: "IN",
        },
        currency: "INR",
        locale: "en",
        method: "prepaid",
        items: [{ variantId, quantity: 2 }],
      },
      "session-min-order"
    );

    expect(quote.subtotalPaise).toBe(40000);
    // Subtotal ₹400 is below free threshold ₹700 -> flat shipping ₹80 (8000 paise)
    expect(quote.shippingPaise).toBe(8000);
    expect(quote.totalPaise).toBe(48000);
  });

  it("applies free delivery when subtotal meets the free delivery threshold", async () => {
    updateDeliverySettings({
      min_delivery_order_rupees: 0,
      shipping_flat_fee_rupees: 99,
      free_shipping_threshold_rupees: 599,
      free_shipping_enabled: true,
      shipping_calculation_mode: "flat",
      dispatch_commitment: "Siliguri hub",
      announcement_auto_sync: false,
      cod_enabled: true,
      cod_fee_rupees: 50,
      cod_min_rupees: 100,
      cod_max_rupees: 5000,
      cod_postcodes: [],
      cod_blocked_skus: [],
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

    const providers = await import("@/lib/international/providers");
    vi.spyOn(providers, "shippingRate").mockResolvedValue({
      id: "std-rate",
      costPaise: 9900,
      expires: Date.now() + 15 * 60000,
      cod: true,
      ddp: false,
      dutiesPaise: 0,
    });

    // 3 items = ₹600 >= ₹599 free threshold -> free delivery (shippingPaise = 0)!
    const quote = await createQuote(
      {
        address: {
          name: "Pooja Das",
          email: "pooja@example.com",
          phone: "+91 9876543210",
          line1: "Sevoke Road",
          city: "Siliguri",
          state: "West Bengal",
          postcode: "734001",
          country: "IN",
        },
        currency: "INR",
        locale: "en",
        method: "prepaid",
        items: [{ variantId, quantity: 3 }],
      },
      "session-free-ship"
    );

    expect(quote.subtotalPaise).toBe(60000);
    expect(quote.shippingPaise).toBe(0);
    expect(quote.totalPaise).toBe(60000);
  });
});
