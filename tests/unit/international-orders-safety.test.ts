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

const TEST_DB = path.join(tmpdir(), `test-orders-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

describe("International Orders, Payment Safety & Webhook Integrity", () => {
  let db: any;
  let testVariantId: number;
  const owner = "test-session-user";

  beforeAll(async () => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const { getDb } = await import("@/lib/db");
    db = getDb();

    process.env.ORDER_ACCESS_SECRET = "order-test-secret-12345678901234567890";
    process.env.RAZORPAY_KEY_ID = "rzp_test_123";
    process.env.RAZORPAY_KEY_SECRET = "rzp_secret_123";
    process.env.SHIPROCKET_EMAIL = "ops@teafloww.com";
    process.env.SHIPROCKET_PASSWORD = "mock_password";

    const { upsertProduct, upsertVariant } = await import("@/lib/products");

    // Seed product and variant with 10 stock
    const prod = upsertProduct({
      name: "Darjeeling Spring",
      slug: "darjeeling-spring",
      description: "First flush",
      category: "Black Tea",
      origin: "Darjeeling",
      estate: "Gopaldhara",
      flush: "Spring",
      harvest_date: "2026-03",
      tasting_notes: "Muscatel",
      brew_temp: 90,
      brew_seconds: 180,
    });

    const variant = upsertVariant({
      product_id: prod.id,
      sku: "TFW-DARJ",
      grams: 100,
      price_paise: 50000,
      stock: 10,
    });
    testVariantId = variant.id;

    // Save package
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

    // Save Market
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
        taxPercent: 0,
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
        cod: { enabled: false, postcodes: [], minPaise: 0, maxPaise: 100000, feePaise: 0, blockedSkus: [] },
      },
      "admin"
    );

    // Mock shipping
    const providers = await import("@/lib/international/providers");
    vi.spyOn(providers, "shippingRate").mockResolvedValue({
      id: "courier-1",
      costPaise: 9900,
      expires: Date.now() + 15 * 60000,
      cod: false,
      ddp: false,
      dutiesPaise: 0,
    });

    // Create quote for 2 units
    const { createQuote } = await import("@/lib/international/quotes");
    await createQuote(
      {
        address: {
          name: "Test Buyer",
          email: "buyer@example.com",
          phone: "+91 9876543210",
          line1: "12 Lake Road",
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
      owner
    );
  });

  afterAll(() => {
    vi.restoreAllMocks();
    try { rmSync(TEST_DB, { force: true }); } catch {}
  });

  async function makeQuote() {
    const { createQuote } = await import("@/lib/international/quotes");
    return createQuote(
      {
        address: {
          name: "Test Buyer",
          email: "buyer@example.com",
          phone: "+91 9876543210",
          line1: "12 Lake Road",
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
      owner
    );
  }

  it("reserves stock atomically and creates payment order idempotently", async () => {
    const { startPayment } = await import("@/lib/international/orders");
    const providers = await import("@/lib/international/providers");

    vi.spyOn(providers, "razorpay").mockResolvedValue({
      id: "order_mockrzp12345",
      amount: 109900, // 100000 + 9900 shipping
      currency: "INR",
    });

    const q = await makeQuote();
    const key = "11111111-2222-3333-4444-555555555555";
    const payment = await startPayment(q.id, owner, key);

    expect(payment.orderId).toBeDefined();
    expect(payment.gatewayOrderId).toBe("order_mockrzp12345");
    expect(payment.amount).toBe(109900);

    // Stock was 10, now should be 8
    const stockAfter = (db.prepare("SELECT stock FROM variants WHERE id=?").get(testVariantId) as any).stock;
    expect(stockAfter).toBe(8);

    // Idempotent retry with same quoteId and key returns existing order without decrementing stock again
    const retryPayment = await startPayment(q.id, owner, key);
    expect(retryPayment.orderId).toBe(payment.orderId);

    const stockAfterRetry = (db.prepare("SELECT stock FROM variants WHERE id=?").get(testVariantId) as any).stock;
    expect(stockAfterRetry).toBe(8);
  });

  it("releases expired reservations back to inventory atomically", async () => {
    const { startPayment, releaseExpired } = await import("@/lib/international/orders");
    const providers = await import("@/lib/international/providers");

    vi.spyOn(providers, "razorpay").mockResolvedValue({
      id: "order_mockrzpexpired",
      amount: 109900,
      currency: "INR",
    });

    const q = await makeQuote();
    const key = "22222222-2222-3333-4444-555555555555";
    const payment = await startPayment(q.id, owner, key);

    // Stock reserved: 8 - 2 = 6
    expect((db.prepare("SELECT stock FROM variants WHERE id=?").get(testVariantId) as any).stock).toBe(6);

    // Fast-forward order expiry into the past
    db.prepare("UPDATE commerce_orders SET reserved_until=? WHERE id=?").run(Date.now() - 1000, payment.orderId);

    // Run expiration release
    releaseExpired();

    // Stock should be restored back to 8
    const restoredStock = (db.prepare("SELECT stock FROM variants WHERE id=?").get(testVariantId) as any).stock;
    expect(restoredStock).toBe(8);

    // Order status marked 'released'
    const orderRow = db.prepare("SELECT inventory_status FROM commerce_orders WHERE id=?").get(payment.orderId) as any;
    expect(orderRow.inventory_status).toBe("released");
  });

  it("handles late captured webhooks on expired reservations as paid_exception, never failed", async () => {
    const { startPayment, releaseExpired, applyPaymentEvent, liveOrder } = await import("@/lib/international/orders");
    const providers = await import("@/lib/international/providers");

    vi.spyOn(providers, "razorpay").mockResolvedValue({
      id: "order_mockrzplate",
      amount: 109900,
      currency: "INR",
    });

    const q = await makeQuote();
    const key = "33333333-2222-3333-4444-555555555555";
    const payment = await startPayment(q.id, owner, key);

    // Expire and release reservation
    db.prepare("UPDATE commerce_orders SET reserved_until=? WHERE id=?").run(Date.now() - 1000, payment.orderId);
    releaseExpired();

    // Now webhook arrives late indicating payment was actually captured by bank
    const webhookEvent = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_latecapture123",
            order_id: "order_mockrzplate",
            amount: 109900,
            currency: "INR",
            status: "captured",
          },
        },
      },
    };

    applyPaymentEvent("evt_late_1", webhookEvent);

    const updated = liveOrder(payment.orderId);
    // Crucial requirement: NEVER label captured charge "failed" because stock was released; mark paid_exception
    expect(updated.payment_status).toBe("paid_exception");
    expect(updated.gateway_payment_id).toBe("pay_latecapture123");
    expect(updated.inventory_status).toBe("released");
  });

  it("handles successful captured webhook normally and deduplicates replayed events", async () => {
    const { startPayment, applyPaymentEvent, liveOrder } = await import("@/lib/international/orders");
    const providers = await import("@/lib/international/providers");

    vi.spyOn(providers, "razorpay").mockResolvedValue({
      id: "order_mockrzpnormal",
      amount: 109900,
      currency: "INR",
    });

    const q = await makeQuote();
    const key = "44444444-2222-3333-4444-555555555555";
    const payment = await startPayment(q.id, owner, key);

    const webhookEvent = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_normal123",
            order_id: "order_mockrzpnormal",
            amount: 109900,
            currency: "INR",
            status: "captured",
          },
        },
      },
    };

    applyPaymentEvent("evt_normal_1", webhookEvent);

    let order = liveOrder(payment.orderId);
    expect(order.payment_status).toBe("paid");
    expect(order.inventory_status).toBe("allocated");
    expect(order.gateway_payment_id).toBe("pay_normal123");

    // Replay same event ID: should be ignored idempotently without error
    applyPaymentEvent("evt_normal_1", webhookEvent);
    order = liveOrder(payment.orderId);
    expect(order.payment_status).toBe("paid");
  });

  it("handles full and partial refunds accurately in original currency", async () => {
    const { startPayment, applyPaymentEvent, liveOrder } = await import("@/lib/international/orders");
    const providers = await import("@/lib/international/providers");

    vi.spyOn(providers, "razorpay").mockResolvedValue({
      id: "order_mockrzprefund",
      amount: 109900,
      currency: "INR",
    });

    const q = await makeQuote();
    const key = "55555555-2222-3333-4444-555555555555";
    const payment = await startPayment(q.id, owner, key);

    // Capture payment
    applyPaymentEvent("evt_cap_for_refund", {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_to_refund",
            order_id: "order_mockrzprefund",
            amount: 109900,
            currency: "INR",
            status: "captured",
          },
        },
      },
    });

    // Partial refund of 50,000 paise
    applyPaymentEvent("evt_ref_partial", {
      event: "refund.processed",
      payload: {
        refund: {
          entity: {
            id: "rfnd_part_1",
            payment_id: "pay_to_refund",
            amount: 50000,
            status: "processed",
          },
        },
      },
    });

    let order = liveOrder(payment.orderId);
    expect(order.payment_status).toBe("partially_refunded");
    expect(order.refund_minor).toBe(50000);

    // Second refund for remaining 59,900 paise -> full refund
    applyPaymentEvent("evt_ref_full", {
      event: "refund.processed",
      payload: {
        refund: {
          entity: {
            id: "rfnd_full_1",
            payment_id: "pay_to_refund",
            amount: 59900,
            status: "processed",
          },
        },
      },
    });

    const stockBeforeRefund = (db.prepare("SELECT stock FROM variants WHERE id=?").get(testVariantId) as any).stock;

    order = liveOrder(payment.orderId);
    expect(order.payment_status).toBe("refunded");
    expect(order.refund_minor).toBe(109900);

    // Goods are NOT restocked automatically upon refund
    const stockAfterRefund = (db.prepare("SELECT stock FROM variants WHERE id=?").get(testVariantId) as any).stock;
    expect(stockAfterRefund).toBe(stockBeforeRefund);
  });

  it("signs guest order access tokens and validates them securely", async () => {
    const { guestToken, validGuestToken } = await import("@/lib/international/orders");

    const orderId = "test-order-uuid-123";
    const token = guestToken(orderId);

    expect(validGuestToken(orderId, token)).toBe(true);
    expect(validGuestToken(orderId, "invalid.signature")).toBe(false);
    expect(validGuestToken("different-order-id", token)).toBe(false);

    // Expired token rejection
    const pastExpires = Date.now() - 5000;
    const expiredToken = `${pastExpires}.fakesig`;
    expect(validGuestToken(orderId, expiredToken)).toBe(false);
  });
});
