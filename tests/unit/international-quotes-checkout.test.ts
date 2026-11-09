process.env.ORDER_ACCESS_SECRET = "isolated-order-test-secret-123456789";
process.env.INTERNATIONAL_RATE_URL = "https://shipping.example.invalid/rate";
process.env.INTERNATIONAL_BOOKING_URL = "https://shipping.example.invalid/book";
process.env.LANDED_COST_URL = "https://shipping.example.invalid/landed";
process.env.COMMERCE_WORKER_SECRET = "isolated-worker-test-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const TEST_DB = path.join(tmpdir(), `test-quotes-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

describe("Authoritative International Quotes & Checkout", () => {
  let db: any;
  let testVariantId: number;
  const testSku = "TFW-DARJ-100G";

  beforeAll(async () => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const { getDb } = await import("@/lib/db");
    db = getDb();

    const { upsertProduct, upsertVariant } = await import("@/lib/products");

    // Seed test product & variant
    const prod = upsertProduct({
      slug: "darjeeling-spring",
      name: "Darjeeling Spring First Flush",
      category: "Black Tea",
      origin: "Darjeeling",
      estate: "Gopaldhara",
      flush: "Spring",
      harvest_date: "2026-03",
      description: "Artisanal spring flush",
      tasting_notes: "Muscatel grapes",
      brew_temp: 90,
      brew_seconds: 180,
    });

    const variant = upsertVariant({
      product_id: prod.id,
      sku: testSku,
      grams: 100,
      price_paise: 75000,
      stock: 50,
    });
    testVariantId = variant.id;

    // Save package config
    const { saveConfig } = await import("@/lib/international/store");
    saveConfig("package", {
      pickupPostcode: "734005",
      pickupLocation: "Siliguri Hub",
      length: 20,
      breadth: 15,
      height: 10,
      tareGrams: 100,
      maxGrams: 5000,
      hsn: "090210",
      origin: "IN",
    });

    // Seed Fresh FX
    const now = Date.now();
    db.prepare("DELETE FROM commerce_fx").run();
    db.prepare("INSERT INTO commerce_fx (id, document, updated_ms, next_ms) VALUES (?, ?, ?, ?)").run(
      "fx-seed-1",
      JSON.stringify({
        id: "fx-seed-1",
        rates: { USD: "0.012", EUR: "0.011", AED: "0.044" },
        updated: now,
        next: now + 3600000,
      }),
      now,
      now + 3600000
    );

    // Mock environment credentials for readiness
    process.env.RAZORPAY_KEY_ID = "rzp_test_mock123";
    process.env.RAZORPAY_KEY_SECRET = "secret_mock123";
    process.env.SHIPROCKET_EMAIL = "ops@teafloww.com";
    process.env.SHIPROCKET_PASSWORD = "mock_password";
  });

  afterAll(() => {
    vi.restoreAllMocks();
    try { rmSync(TEST_DB, { force: true }); } catch {}
  });

  it("creates an authoritative quote for India flat delivery and calculates total exactly", async () => {
    const { createQuote, getQuote } = await import("@/lib/international/quotes");
    const { saveMarket } = await import("@/lib/international/store");

    // Configure India market as enabled and approved
    saveMarket(
      {
        code: "IN",
        name: "India",
        covered: true,
        enabled: true,
        currency: "INR",
        language: "en",
        approvedCurrencies: ["INR"],
        taxApproved: true,
        taxPercent: 5,
        taxInclusive: true,
        exportApproved: true,
        duties: "recipient",
        shipping: "flat",
        flatPaise: 9900,
        freeAbovePaise: 150000,
        handlingPaise: 0,
        subsidyPaise: 0,
        fxMarkupBps: 0,
        roundingMinor: 1,
        blockedPostcodes: ["110099"],
        blockedStates: [],
        blockedSkus: [],
        cod: {
          enabled: true,
          postcodes: ["734005", "110001"],
          minPaise: 50000,
          maxPaise: 500000,
          feePaise: 5000,
          blockedSkus: [],
        },
      },
      "test-admin"
    );

    // Mock domestic shipping rate
    const providers = await import("@/lib/international/providers");
    vi.spyOn(providers, "shippingRate").mockResolvedValue({
      id: "courier-123",
      costPaise: 9000,
      expires: Date.now() + 15 * 60000,
      cod: true,
      ddp: false,
      dutiesPaise: 0,
    });

    const quoteInput = {
      address: {
        name: "Aarav Sharma",
        email: "aarav@example.com",
        phone: "+91 9876543210",
        line1: "12 Lake View Road",
        city: "Siliguri",
        state: "West Bengal",
        postcode: "734005",
        country: "IN",
      },
      currency: "INR",
      locale: "en" as const,
      method: "prepaid" as const,
      items: [{ variantId: testVariantId, quantity: 1 }],
    };

    const quote = await createQuote(quoteInput, "session-user-1");

    expect(quote.id).toBeDefined();
    expect(quote.currency).toBe("INR");
    expect(quote.subtotalPaise).toBe(75000);
    expect(quote.shippingPaise).toBe(9900); // Below 150000 threshold -> flat 9900
    expect(quote.totalPaise).toBe(75000 + 9900);
    expect(quote.totalMinor).toBe(84900); // 849.00 INR in paise

    // Verify component total preservation: sum of minor components equals totalMinor
    const sum = Object.values(quote.components).reduce((a, b) => a + b, 0);
    expect(sum).toBe(quote.totalMinor);

    // Test retrieving valid quote
    const retrieved = getQuote(quote.id, "session-user-1");
    expect(retrieved.id).toBe(quote.id);
  });

  it("applies free shipping when merchandise exceeds the freeAbovePaise threshold", async () => {
    const { createQuote } = await import("@/lib/international/quotes");
    const { saveMarket } = await import("@/lib/international/store");

    saveMarket(
      {
        code: "IN",
        name: "India",
        covered: true,
        enabled: true,
        currency: "INR",
        language: "en",
        approvedCurrencies: ["INR"],
        taxApproved: true,
        taxPercent: 5,
        taxInclusive: true,
        exportApproved: true,
        duties: "recipient",
        shipping: "flat",
        flatPaise: 9900,
        freeAbovePaise: 100000, // 1000 INR
        handlingPaise: 0,
        subsidyPaise: 0,
        fxMarkupBps: 0,
        roundingMinor: 1,
        blockedPostcodes: [],
        blockedStates: [],
        blockedSkus: [],
        cod: { enabled: false, postcodes: [], minPaise: 0, maxPaise: 100000, feePaise: 0, blockedSkus: [] },
      },
      "test-admin"
    );

    const providers = await import("@/lib/international/providers");
    vi.spyOn(providers, "shippingRate").mockResolvedValue({
      id: "courier-123",
      costPaise: 8000,
      expires: Date.now() + 15 * 60000,
      cod: false,
      ddp: false,
      dutiesPaise: 0,
    });

    // 2 x 750 INR = 1500 INR (150,000 paise) > 100,000 paise
    const quote = await createQuote(
      {
        address: {
          name: "Aarav Sharma",
          email: "aarav@example.com",
          phone: "+91 9876543210",
          line1: "12 Lake View Road",
          city: "Siliguri",
          state: "West Bengal",
          postcode: "734005",
          country: "IN",
        },
        currency: "INR",
        locale: "en" as const,
        method: "prepaid" as const,
        items: [{ variantId: testVariantId, quantity: 2 }],
      },
      "session-user-1"
    );

    expect(quote.shippingPaise).toBe(0);
    expect(quote.totalPaise).toBe(150000);
  });

  it("blocks checkout when destination address is in a blocked postcode or state", async () => {
    const { createQuote } = await import("@/lib/international/quotes");
    const { saveMarket } = await import("@/lib/international/store");

    saveMarket(
      {
        code: "IN",
        name: "India",
        covered: true,
        enabled: true,
        currency: "INR",
        language: "en",
        approvedCurrencies: ["INR"],
        taxApproved: true,
        taxPercent: 5,
        taxInclusive: true,
        exportApproved: true,
        duties: "recipient",
        shipping: "flat",
        flatPaise: 9900,
        freeAbovePaise: null,
        handlingPaise: 0,
        subsidyPaise: 0,
        fxMarkupBps: 0,
        roundingMinor: 1,
        blockedPostcodes: ["110099"],
        blockedStates: ["RestrictedState"],
        blockedSkus: [],
        cod: { enabled: false, postcodes: [], minPaise: 0, maxPaise: 100000, feePaise: 0, blockedSkus: [] },
      },
      "test-admin"
    );

    await expect(
      createQuote(
        {
          address: {
            name: "Test",
            email: "test@example.com",
            phone: "+91 9876543210",
            line1: "Blocked Lane",
            city: "Delhi",
            state: "Delhi",
            postcode: "110099",
            country: "IN",
          },
          currency: "INR",
          locale: "en" as const,
          method: "prepaid" as const,
          items: [{ variantId: testVariantId, quantity: 1 }],
        },
        "session-user-1"
      )
    ).rejects.toThrow("Delivery is not available at this address.");
  });

  it("blocks checkout for destination-excluded SKUs", async () => {
    const { createQuote } = await import("@/lib/international/quotes");
    const { saveMarket } = await import("@/lib/international/store");

    saveMarket(
      {
        code: "IN",
        name: "India",
        covered: true,
        enabled: true,
        currency: "INR",
        language: "en",
        approvedCurrencies: ["INR"],
        taxApproved: true,
        taxPercent: 5,
        taxInclusive: true,
        exportApproved: true,
        duties: "recipient",
        shipping: "flat",
        flatPaise: 9900,
        freeAbovePaise: null,
        handlingPaise: 0,
        subsidyPaise: 0,
        fxMarkupBps: 0,
        roundingMinor: 1,
        blockedPostcodes: [],
        blockedStates: [],
        blockedSkus: [testSku], // Exclude test SKU
        cod: { enabled: false, postcodes: [], minPaise: 0, maxPaise: 100000, feePaise: 0, blockedSkus: [] },
      },
      "test-admin"
    );

    await expect(
      createQuote(
        {
          address: {
            name: "Test",
            email: "test@example.com",
            phone: "+91 9876543210",
            line1: "Sample Road",
            city: "Siliguri",
            state: "West Bengal",
            postcode: "734005",
            country: "IN",
          },
          currency: "INR",
          locale: "en" as const,
          method: "prepaid" as const,
          items: [{ variantId: testVariantId, quantity: 1 }],
        },
        "session-user-1"
      )
    ).rejects.toThrow("A selected tea is unavailable for this destination or quantity.");
  });

  it("validates India COD eligibility strictly by postcode, min/max limits and fee", async () => {
    const { createQuote } = await import("@/lib/international/quotes");
    const { saveMarket } = await import("@/lib/international/store");

    saveMarket(
      {
        code: "IN",
        name: "India",
        covered: true,
        enabled: true,
        currency: "INR",
        language: "en",
        approvedCurrencies: ["INR"],
        taxApproved: true,
        taxPercent: 5,
        taxInclusive: true,
        exportApproved: true,
        duties: "recipient",
        shipping: "flat",
        flatPaise: 9900,
        freeAbovePaise: null,
        handlingPaise: 0,
        subsidyPaise: 0,
        fxMarkupBps: 0,
        roundingMinor: 1,
        blockedPostcodes: [],
        blockedStates: [],
        blockedSkus: [],
        cod: {
          enabled: true,
          postcodes: ["734005"],
          minPaise: 50000, // 500 INR
          maxPaise: 100000, // 1000 INR
          feePaise: 5000, // 50 INR
          blockedSkus: [],
        },
      },
      "test-admin"
    );

    const providers = await import("@/lib/international/providers");
    vi.spyOn(providers, "shippingRate").mockResolvedValue({
      id: "courier-cod",
      costPaise: 9000,
      expires: Date.now() + 15 * 60000,
      cod: true,
      ddp: false,
      dutiesPaise: 0,
    });

    // 1 tea = 750 INR (between 500 and 1000 INR), eligible!
    const quote = await createQuote(
      {
        address: {
          name: "COD Customer",
          email: "cod@example.com",
          phone: "+91 9876543210",
          line1: "Mall Road",
          city: "Siliguri",
          state: "West Bengal",
          postcode: "734005",
          country: "IN",
        },
        currency: "INR",
        locale: "en" as const,
        method: "cod" as const,
        items: [{ variantId: testVariantId, quantity: 1 }],
      },
      "session-user-1"
    );

    expect(quote.components.cod).toBe(5000);
    expect(quote.totalPaise).toBe(75000 + 9900 + 5000);

    // Ineligible postcode throws
    await expect(
      createQuote(
        {
          address: {
            name: "COD Customer",
            email: "cod@example.com",
            phone: "+91 9876543210",
            line1: "Other Road",
            city: "Kolkata",
            state: "West Bengal",
            postcode: "700001", // Not in COD postcodes
            country: "IN",
          },
          currency: "INR",
          locale: "en" as const,
          method: "cod" as const,
          items: [{ variantId: testVariantId, quantity: 1 }],
        },
        "session-user-1"
      )
    ).rejects.toThrow("Cash on delivery is not available for this order.");
  });

  it("handles international checkout with currency conversion and duties disclosure", async () => {
    const { createQuote } = await import("@/lib/international/quotes");
    const { saveMarket } = await import("@/lib/international/store");

    // Configure US market
    process.env.INTERNATIONAL_RATE_URL = "https://mock-shipping.teafloww.internal/rates";
    saveMarket(
      {
        code: "US",
        name: "United States",
        covered: true,
        enabled: true,
        currency: "USD",
        language: "en",
        approvedCurrencies: ["USD", "INR"],
        taxApproved: true,
        taxPercent: 0,
        taxInclusive: true,
        exportApproved: true,
        duties: "recipient", // Recipient pays
        shipping: "live",
        flatPaise: 0,
        freeAbovePaise: null,
        handlingPaise: 5000, // 50 INR handling
        subsidyPaise: 0,
        fxMarkupBps: 0,
        roundingMinor: 1,
        blockedPostcodes: [],
        blockedStates: [],
        blockedSkus: [],
        cod: { enabled: false, postcodes: [], minPaise: 0, maxPaise: 100000, feePaise: 0, blockedSkus: [] },
      },
      "test-admin"
    );

    const providers = await import("@/lib/international/providers");
    vi.spyOn(providers, "shippingRate").mockResolvedValue({
      id: "intl-fedex",
      costPaise: 150000, // 1500 INR shipping
      expires: Date.now() + 15 * 60000,
      cod: false,
      ddp: false,
      dutiesPaise: 0,
    });

    const quote = await createQuote(
      {
        address: {
          name: "John Doe",
          email: "john@example.com",
          phone: "+1 555 123 4567",
          line1: "123 Tea Boulevard",
          city: "San Francisco",
          state: "California",
          postcode: "94105",
          country: "US",
        },
        currency: "USD",
        locale: "en" as const,
        method: "prepaid" as const,
        items: [{ variantId: testVariantId, quantity: 1 }],
      },
      "session-intl-1"
    );

    expect(quote.currency).toBe("USD");
    expect(quote.rate).toBe("0.012");
    // Merchandise: 750 INR * 0.012 = $9.00 = 900 cents
    expect(quote.components.merchandise).toBe(900);
    // Shipping: (1500 INR + 50 INR handling) = 1550 INR * 0.012 = $18.60 = 1860 cents
    expect(quote.components.shipping).toBe(1860);
    expect(quote.totalMinor).toBe(900 + 1860);
  });

  it("permits tasting kit / trial lines with slug or custom string IDs in quotes and COD checkout", async () => {
    const { createQuote } = await import("@/lib/international/quotes");
    const { startPayment } = await import("@/lib/international/orders");
    const { saveMarket } = await import("@/lib/international/store");
    const providers = await import("@/lib/international/providers");

    vi.spyOn(providers, "shippingRate").mockResolvedValue({
      id: "carrier-cod",
      costPaise: 9900,
      expires: Date.now() + 15 * 60000,
      cod: true,
      ddp: false,
      dutiesPaise: 0,
    });

    saveMarket(
      {
        code: "IN",
        name: "India",
        covered: true,
        enabled: true,
        currency: "INR",
        language: "en",
        approvedCurrencies: ["INR"],
        taxApproved: true,
        taxPercent: 5,
        taxInclusive: true,
        exportApproved: true,
        duties: "recipient",
        shipping: "flat",
        flatPaise: 9900,
        freeAbovePaise: 59900,
        handlingPaise: 0,
        subsidyPaise: 0,
        fxMarkupBps: 0,
        roundingMinor: 1,
        blockedPostcodes: [],
        blockedStates: [],
        blockedSkus: [],
        cod: {
          enabled: true,
          postcodes: [],
          minPaise: 10000,
          maxPaise: 500000,
          feePaise: 5000,
          blockedSkus: [],
        },
      },
      "test-admin"
    );

    // Seed a trial as draft, add 4 components, then publish (respecting database transition trigger)
    db.prepare(`
      INSERT OR REPLACE INTO trials (
        id, slug, title, status, pack_format, net_weight_g, price_paise, sku, inventory_quantity, inventory_policy
      ) VALUES (
        'trial-discovery-200g-001', 'tea-stall-discovery-kit', 'TeaFloww Four-Tea Discovery Kit', 'draft',
        '4x50g_sachets', 200, 26900, 'TRIAL-DISCOVERY-200G', 50, 'track'
      )
    `).run();

    // Ensure 4 components exist for the trial
    db.prepare("DELETE FROM trial_components WHERE trial_id = 'trial-discovery-200g-001'").run();
    for (let i = 0; i < 4; i++) {
      db.prepare(`
        INSERT INTO trial_components (id, trial_id, slot_index, name, regular_variant_id, weight_g, quantity)
        VALUES (?, 'trial-discovery-200g-001', ?, ?, ?, 50, 1)
      `).run(`comp-${i}`, i, `Component Tea ${i + 1}`, testVariantId);
    }

    db.prepare("UPDATE trials SET status = 'published' WHERE id = 'trial-discovery-200g-001'").run();

    const quote = await createQuote(
      {
        address: {
          name: "Darjeeling Connoisseur",
          email: "connoisseur@teafloww.com",
          phone: "+91 98765 43210",
          line1: "Heritage Tea Bungalow, Hill Cart Road",
          line2: "Suite 4B",
          city: "Siliguri",
          state: "West Bengal",
          postcode: "734005",
          country: "IN",
        },
        currency: "INR",
        locale: "en" as const,
        method: "cod" as const,
        items: [
          { variantId: 0, trialId: "trial-discovery-200g-001", quantity: 1 },
          { variantId: testVariantId, quantity: 1 },
        ],
      },
      "session-cod-trial"
    );

    expect(quote.currency).toBe("INR");
    expect(quote.lines.length).toBe(2);
    expect(quote.lines.some((l) => l.trialId === "trial-discovery-200g-001")).toBe(true);
    expect(quote.subtotalPaise).toBe(26900 + 75000);

    const payment = await startPayment(quote.id, "session-cod-trial", "7c9e6679-7425-40de-944b-e07fc1f90ae7");
    expect(payment.paymentStatus).toBe("cod_due");
    expect(payment.preferredMethod).toBe("cod");
    expect(payment.orderId).toBeDefined();
  });
});
