process.env.INTERNATIONAL_RATE_URL = "https://shipping.example.invalid/rate";
process.env.INTERNATIONAL_BOOKING_URL = "https://shipping.example.invalid/book";
process.env.LANDED_COST_URL = "https://shipping.example.invalid/landed";
process.env.COMMERCE_WORKER_SECRET = "isolated-worker-test-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
process.env.ORDER_ACCESS_SECRET = "test_order_access_secret_1234567890";

import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { setupAdminTestEnv, type TestEnv } from "./admin-e2e/test-helper";
import { packageSchema, CommerceError } from "@/lib/international/models";
import { markets, saveMarket, saveConfig } from "@/lib/international/store";
import { createQuote } from "@/lib/international/quotes";
import { startPayment, confirmBankTransferPayment, switchOrderToCod, liveOrder } from "@/lib/international/orders";
import { upsertProduct } from "@/lib/products";
import { updatePaymentSettings } from "@/lib/paymentSettings";

describe("Wholesale Checkout Flow & Advance PG / Bank Transfer", () => {
  let env: TestEnv;
  let wholesaleVariantId: number;
  const session = "wholesale-buyer-session-1";

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
    const { version: _version, ...india } = m;
    void _version;
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

    // Create a product with wholesale slabs
    upsertProduct({
      name: "Wholesale Test Orthodox Tea",
      slug: "wholesale-test-orthodox-tea",
      category: "Black Tea",
      origin: "Darjeeling, India",
      estate: "Happy Valley",
      flush: "First Flush",
      harvest_date: "Spring 2026",
      description: "Organic Darjeeling loose leaf tea for wholesale testing",
      tasting_notes: "Floral, Muscatel",
      brew_temp: 95,
      brew_seconds: 180,
      wholesale_moq: 50,
      variants: [
        {
          sku: "WS-TEST-100G",
          grams: 100,
          packaging_format: "loose_leaf_pouch",
          price_paise: 10000, // Retail: ₹100
          stock: 2000,
          wholesale_slabs: [
            { min_qty: 50, price_paise: 8000 },  // ₹80 for 50-99
            { min_qty: 100, price_paise: 7000 }, // ₹70 for 100+
          ],
        },
      ],
    });

    const fullProduct = env.db.prepare("SELECT id FROM products WHERE slug=?").get("wholesale-test-orthodox-tea") as { id: number };
    const variants = env.db.prepare("SELECT id, sku FROM variants WHERE product_id=? ORDER BY id ASC").all(fullProduct.id) as Array<{ id: number; sku: string }>;

    wholesaleVariantId = variants[0].id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    env.cleanup();
  });

  function mockRazorpay() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/orders")) {
          const body = JSON.parse(String(init?.body || "{}"));
          return Response.json({
            id: `order_rzp${randomUUID().replace(/-/g, "").slice(0, 14)}`,
            amount: body.amount,
            currency: body.currency,
          });
        }
        return Response.json({});
      })
    );
  }

  const validAddress = {
    name: "Himalayan Wholesale Buyer",
    phone: "+91 9876543210",
    email: "buyer@himalayanwholesale.com",
    line1: "100 Commercial Transport Hub",
    city: "Siliguri",
    state: "West Bengal",
    postcode: "734005",
    country: "IN",
  };

  it("applies wholesale slab pricing and marks shipping as wholesale_transport_topay (₹0 online)", async () => {
    const quote = await createQuote(
      {
        items: [{ variantId: wholesaleVariantId, quantity: 100 }],
        address: validAddress,
        currency: "INR",
        locale: "en",
        method: "bank_transfer",
      },
      session
    );

    expect(quote.wholesale).toBeDefined();
    expect(quote.wholesale?.isWholesale).toBe(true);
    // 100 * ₹70 = ₹7,000 = 700000 paise
    expect(quote.subtotalPaise).toBe(700000);
    // Surface freight is To-Pay Bilty (zero online)
    expect(quote.shippingPaise).toBe(0);
    expect(quote.carrier).toBe("wholesale_transport_topay");
  });

  it("strictly disables Cash on Delivery (COD) for wholesale orders", async () => {
    await expect(
      createQuote(
        {
          items: [{ variantId: wholesaleVariantId, quantity: 50 }],
          address: validAddress,
          currency: "INR",
          locale: "en",
          method: "cod",
        },
        session
      )
    ).rejects.toThrow(CommerceError);
  });

  it("handles 0% advance (100% direct bank transfer): skips PG payment", async () => {
    updatePaymentSettings({
      wholesale_advance_percent: 0,
      wholesale_bank_beneficiary: "Nirva Tea Estate",
      wholesale_bank_name: "HDFC Bank",
      wholesale_bank_account_number: "50200012345678",
      wholesale_bank_ifsc: "HDFC0000123",
      wholesale_bank_branch: "Siliguri",
    });

    const quote = await createQuote(
      {
        items: [{ variantId: wholesaleVariantId, quantity: 100 }],
        address: validAddress,
        currency: "INR",
        locale: "en",
        method: "bank_transfer",
      },
      session
    );

    expect(quote.wholesale?.advancePercent).toBe(0);
    expect(quote.wholesale?.advancePaise).toBe(0);
    expect(quote.wholesale?.balancePaise).toBe(quote.totalPaise);

    // Start payment: should skip PG and create order as pending_bank_transfer
    const paymentResult = await startPayment(quote.id, session, randomUUID());
    expect(paymentResult.paymentStatus).toBe("pending_bank_transfer");
    expect(paymentResult.gateway).toBe("bank_transfer");

    const order = liveOrder(paymentResult.orderId);
    expect(order.payment_status).toBe("pending_bank_transfer");
  });

  it("handles x > 0% advance: calculates advance and sets payable amount for PG", async () => {
    mockRazorpay();
    updatePaymentSettings({
      wholesale_advance_percent: 20,
    });

    const quote = await createQuote(
      {
        items: [{ variantId: wholesaleVariantId, quantity: 100 }],
        address: validAddress,
        currency: "INR",
        locale: "en",
        method: "upi",
      },
      session
    );

    expect(quote.wholesale?.advancePercent).toBe(20);
    // Subtotal = ₹7,000 = 700000 paise. 20% advance = 140000 paise.
    expect(quote.wholesale?.advancePaise).toBe(140000);
    expect(quote.wholesale?.balancePaise).toBe(560000);

    // Start payment: charges the advance payable amount (140000 paise = ₹1400)
    const paymentResult = await startPayment(quote.id, session, randomUUID());
    expect(paymentResult.amount).toBe(140000); // 140000 paise = ₹1400
    expect(paymentResult.preferredMethod).toBe("wholesale_advance");

    const order = liveOrder(paymentResult.orderId);
    expect(order.payment_status).toBe("payment_pending");
  });

  it("prevents switching wholesale orders to Cash on Delivery", async () => {
    updatePaymentSettings({ wholesale_advance_percent: 0 });

    const quote = await createQuote(
      {
        items: [{ variantId: wholesaleVariantId, quantity: 50 }],
        address: validAddress,
        currency: "INR",
        locale: "en",
        method: "bank_transfer",
      },
      session
    );

    const paymentResult = await startPayment(quote.id, session, randomUUID());

    expect(() => {
      switchOrderToCod(paymentResult.orderId, paymentResult.token);
    }).toThrow(CommerceError);
  });

  it("allows admin to confirm full bank transfer payment before dispatch", async () => {
    updatePaymentSettings({ wholesale_advance_percent: 0 });

    const quote = await createQuote(
      {
        items: [{ variantId: wholesaleVariantId, quantity: 50 }],
        address: validAddress,
        currency: "INR",
        locale: "en",
        method: "bank_transfer",
      },
      session
    );

    const paymentResult = await startPayment(quote.id, session, randomUUID());
    expect(paymentResult.paymentStatus).toBe("pending_bank_transfer");

    // Admin confirms receipt of bank transfer
    const updated = confirmBankTransferPayment(
      paymentResult.orderId,
      "admin",
      "HDFC99887766",
      "Verified in company account statement"
    );

    expect(updated.payment_status).toBe("paid");

    const retrieved = liveOrder(paymentResult.orderId);
    expect(retrieved.payment_status).toBe("paid");

    // Confirming an already paid order should throw
    expect(() => {
      confirmBankTransferPayment(paymentResult.orderId, "admin");
    }).toThrow(CommerceError);
  });
});
