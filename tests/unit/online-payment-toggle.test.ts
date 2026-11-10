process.env.INTERNATIONAL_RATE_URL = "https://shipping.example.invalid/rate";
process.env.INTERNATIONAL_BOOKING_URL = "https://shipping.example.invalid/book";
process.env.LANDED_COST_URL = "https://shipping.example.invalid/landed";
process.env.COMMERCE_WORKER_SECRET = "isolated-worker-test-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { setupAdminTestEnv, type TestEnv } from "./admin-e2e/test-helper";
import { upsertProduct } from "@/lib/products";
import { productSchema, normalizeProductInput } from "@/lib/validation";
import { packageSchema, type QuoteInput } from "@/lib/international/models";
import { markets, saveMarket, saveConfig } from "@/lib/international/store";
import { createQuote } from "@/lib/international/quotes";
import { startPayment } from "@/lib/international/orders";
import { getPaymentSettings, updatePaymentSettings } from "@/lib/paymentSettings";

describe("Admin Online Payment Toggle & COD-Only Mode", () => {
  let env: TestEnv;
  let variant: number;
  let product: number;
  const session = randomUUID();
  const oldEnv = { ...process.env };

  beforeAll(() => {
    env = setupAdminTestEnv();
    Object.assign(process.env, {
      RAZORPAY_KEY_ID: "rzp_test_local",
      RAZORPAY_KEY_SECRET: "test_secret",
      SHIPROCKET_EMAIL: "test@example.invalid",
      SHIPROCKET_PASSWORD: "test_password",
    });

    saveConfig(
      "package",
      packageSchema.parse({
        pickupPostcode: "734015",
        pickupLocation: "Test",
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
        cod: {
          ...india.cod,
          enabled: true,
          feePaise: 5000, // ₹50 COD fee
          postcodes: ["734005"],
          minPaise: 1000,
          maxPaise: 500000,
        },
      },
      "test"
    );

    env.db
      .prepare(
        `INSERT INTO store_settings (key, value, updated_at) VALUES 
        ('online_payment_enabled', '1', CURRENT_TIMESTAMP),
        ('cod_enabled', '1', CURRENT_TIMESTAMP),
        ('cod_fee_paise', '5000', CURRENT_TIMESTAMP),
        ('cod_min_paise', '10000', CURRENT_TIMESTAMP),
        ('cod_max_paise', '500000', CURRENT_TIMESTAMP),
        ('free_shipping_threshold_paise', '59900', CURRENT_TIMESTAMP),
        ('shipping_flat_fee_paise', '9900', CURRENT_TIMESTAMP),
        ('free_shipping_enabled', '1', CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value`
      )
      .run();

    product = upsertProduct(
      productSchema.parse(
        normalizeProductInput({ slug: "toggle-test-tea", name: "Toggle Test Tea", status: "published" })
      )
    ).id;
    variant = Number(
      env.db
        .prepare("INSERT INTO variants (product_id,sku,grams,price_paise,stock) VALUES (?,?,?,?,?)")
        .run(product, "TOGGLE-100", 100, 100000, 50).lastInsertRowid
    );
  });

  afterAll(() => {
    process.env = oldEnv;
    env.cleanup();
  });

  const makeInput = (overrides: Partial<QuoteInput> = {}): QuoteInput => ({
    address: {
      name: "Tasting Tester",
      phone: "+91 98765 43210",
      email: "tea@example.invalid",
      country: "IN",
      line1: "123 Darjeeling Ridge",
      line2: "",
      city: "Siliguri",
      state: "West Bengal",
      postcode: "734005",
    },
    currency: "INR",
    locale: "en",
    method: "upi",
    coupon: "",
    items: [{ variantId: variant, quantity: 1 }],
    ...overrides,
  });

  it("defaults online_payment_enabled to true", () => {
    const settings = getPaymentSettings();
    expect(settings.online_payment_enabled).toBe(true);
  });

  it("allows disabling online payments via updatePaymentSettings", () => {
    const current = getPaymentSettings();
    const updated = updatePaymentSettings({
      ...current,
      online_payment_enabled: false,
    });
    expect(updated.online_payment_enabled).toBe(false);

    const reloaded = getPaymentSettings();
    expect(reloaded.online_payment_enabled).toBe(false);
  });

  it("rejects online payment quote creation when online payments are disabled", async () => {
    // Ensure online payment is disabled
    env.db.prepare("UPDATE store_settings SET value = '0' WHERE key = 'online_payment_enabled'").run();

    await expect(createQuote(makeInput({ method: "upi" }), session)).rejects.toThrow(
      "Online payment is currently disabled. Please checkout using Cash on Delivery."
    );

    await expect(createQuote(makeInput({ method: "card" }), session)).rejects.toThrow(
      "Online payment is currently disabled. Please checkout using Cash on Delivery."
    );

    await expect(createQuote(makeInput({ method: "prepaid" }), session)).rejects.toThrow(
      "Online payment is currently disabled. Please checkout using Cash on Delivery."
    );
  });

  it("permits Cash on Delivery (COD) quote creation and checkout when online payments are disabled", async () => {
    // Online payments disabled
    env.db.prepare("UPDATE store_settings SET value = '0' WHERE key = 'online_payment_enabled'").run();

    const quote = await createQuote(makeInput({ method: "cod" }), session);
    expect(quote.input.method).toBe("cod");
    expect(quote.totalPaise).toBeGreaterThan(0);

    const paymentResult = await startPayment(quote.id, session, randomUUID());
    expect(paymentResult.paymentStatus).toBe("cod_due");
    expect(paymentResult.gateway).toBe("cod");
    expect(paymentResult.preferredMethod).toBe("cod");
  });

  it("re-enables online payment quote creation when online_payment_enabled is set back to true", async () => {
    const current = getPaymentSettings();
    updatePaymentSettings({
      ...current,
      online_payment_enabled: true,
    });

    const quote = await createQuote(makeInput({ method: "upi" }), session);
    expect(quote.input.method).toBe("upi");
    expect(quote.totalPaise).toBeGreaterThan(0);
  });
});
