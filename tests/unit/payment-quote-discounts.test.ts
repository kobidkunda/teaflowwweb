process.env.INTERNATIONAL_RATE_URL = "https://shipping.example.invalid/rate";
process.env.INTERNATIONAL_BOOKING_URL = "https://shipping.example.invalid/book";
process.env.LANDED_COST_URL = "https://shipping.example.invalid/landed";
process.env.COMMERCE_WORKER_SECRET = "isolated-worker-test-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";

import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { setupAdminTestEnv, type TestEnv } from "./admin-e2e/test-helper";
import { upsertProduct } from "@/lib/products";
import { productSchema, normalizeProductInput } from "@/lib/validation";
import { packageSchema } from "@/lib/international/models";
import { markets, saveMarket, saveConfig } from "@/lib/international/store";
import { createQuote, publicQuote } from "@/lib/international/quotes";

describe("Payment Quote Discounts & Shipping Thresholds", () => {
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

    // Save payment discount settings in store_settings
    env.db
      .prepare(
        `INSERT INTO store_settings (key, value, updated_at) VALUES 
        ('upi_discount_enabled', '1', CURRENT_TIMESTAMP),
        ('upi_discount_type', 'percentage', CURRENT_TIMESTAMP),
        ('upi_discount_value', '2', CURRENT_TIMESTAMP),
        ('upi_discount_max_rupees', '150', CURRENT_TIMESTAMP),
        ('card_discount_enabled', '1', CURRENT_TIMESTAMP),
        ('card_discount_type', 'percentage', CURRENT_TIMESTAMP),
        ('card_discount_value', '1', CURRENT_TIMESTAMP),
        ('card_discount_max_rupees', '100', CURRENT_TIMESTAMP),
        ('cod_enabled', '1', CURRENT_TIMESTAMP),
        ('cod_fee_paise', '5000', CURRENT_TIMESTAMP),
        ('free_shipping_threshold_paise', '59900', CURRENT_TIMESTAMP),
        ('shipping_flat_fee_paise', '9900', CURRENT_TIMESTAMP),
        ('free_shipping_enabled', '1', CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value`
      )
      .run();

    product = upsertProduct(
      productSchema.parse(
        normalizeProductInput({ slug: "discount-test-tea", name: "Discount Test Tea", status: "published" })
      )
    ).id;
    // Price = ₹1,000 (100,000 paise)
    variant = Number(
      env.db
        .prepare("INSERT INTO variants (product_id,sku,grams,price_paise,stock) VALUES (?,?,?,?,?)")
        .run(product, "DISC-100", 100, 100000, 50).lastInsertRowid
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    env.cleanup();
    process.env = oldEnv;
  });

  function makeInput(overrides: Record<string, unknown> = {}) {
    return {
      address: {
        name: "Test Buyer",
        email: "test@example.invalid",
        phone: "+917001304853",
        line1: "Siliguri Tea Hub",
        line2: "",
        city: "Siliguri",
        state: "West Bengal",
        postcode: "734005",
        country: "IN",
      },
      currency: "INR",
      locale: "en",
      method: "upi" as const,
      coupon: "",
      items: [{ variantId: variant, quantity: 1 }],
      ...overrides,
    };
  }

  function mockShippingService() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("auth/login")) return Response.json({ token: "test-token" });
        if (url.includes("courier/serviceability")) {
          return Response.json({
            data: {
              available_courier_companies: [{ courier_company_id: 1, rate: 100, cod: 1 }],
            },
          });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      })
    );
  }

  it("applies 2% instant discount on UPI orders and qualifies for free shipping over threshold", async () => {
    mockShippingService();
    // Merchandise = 100,000 paise (₹1,000) > ₹599 free shipping threshold
    // Shipping = 0
    // UPI Discount = 2% of 100,000 = 2,000 paise (₹20)
    // Payable total = 100,000 - 2,000 = 98,000 paise (₹980)
    const quote = await createQuote(makeInput({ method: "upi" }), session);

    expect(quote.subtotalPaise).toBe(100000);
    expect(quote.shippingPaise).toBe(0); // Free shipping
    expect(quote.paymentDiscountPaise).toBe(2000);
    expect(quote.components.paymentDiscount).toBe(-2000);
    expect(quote.components.cod).toBe(0);
    expect(quote.totalMinor).toBe(98000);

    const pub = publicQuote(quote);
    expect(pub.paymentDiscountPaise).toBe(2000);
    expect(pub.components.paymentDiscount).toBe(-2000);
  });

  it("applies 1% discount on Card orders", async () => {
    mockShippingService();
    // Card Discount = 1% of 100,000 = 1,000 paise (₹10)
    // Payable total = 100,000 - 1,000 = 99,000 paise (₹990)
    const quote = await createQuote(makeInput({ method: "card" }), session);

    expect(quote.paymentDiscountPaise).toBe(1000);
    expect(quote.components.paymentDiscount).toBe(-1000);
    expect(quote.totalMinor).toBe(99000);
  });

  it("adds COD handling fee and provides zero discount on COD orders", async () => {
    mockShippingService();
    // COD: Discount = 0
    // COD fee = 5,000 paise (₹50)
    // Shipping = 0 (merchandise ₹1,000 >= ₹599)
    // Total = 100,000 + 5,000 = 105,000 paise (₹1,050)
    const quote = await createQuote(makeInput({ method: "cod" }), session);

    expect(quote.paymentDiscountPaise).toBe(0);
    expect(quote.components.paymentDiscount).toBeUndefined();
    expect(quote.components.cod).toBe(5000);
    expect(quote.totalMinor).toBe(105000);
  });

  it("charges flat shipping fee for orders below the free shipping threshold", async () => {
    mockShippingService();
    // Create a lower-cost variant: ₹300 (30,000 paise) < ₹599 threshold
    const lowVariant = Number(
      env.db
        .prepare("INSERT INTO variants (product_id,sku,grams,price_paise,stock) VALUES (?,?,?,?,?)")
        .run(product, "LOW-50", 50, 30000, 20).lastInsertRowid
    );

    // Order: ₹300 with UPI
    // Shipping: ₹99 (9,900 paise) flat fee
    // UPI Discount: 2% of 30,000 = 600 paise (₹6)
    // Total = (30,000 - 600) + 9,900 = 39,300 paise (₹393)
    const quote = await createQuote(
      makeInput({
        method: "upi",
        items: [{ variantId: lowVariant, quantity: 1 }],
      }),
      session
    );

    expect(quote.subtotalPaise).toBe(30000);
    expect(quote.shippingPaise).toBe(9900);
    expect(quote.paymentDiscountPaise).toBe(600);
    expect(quote.totalMinor).toBe(39300);
  });
});
