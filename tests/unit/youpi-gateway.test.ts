import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto, { randomUUID } from "node:crypto";
import { YoupiPaymentClient, type YoupiWebhookEvent } from "@/lib/youpi/client";
import {
  resolveActiveGateway,
  getPaymentSettings,
  updatePaymentSettings,
} from "@/lib/paymentSettings";
import { getDb } from "@/lib/db";
import { applyYoupiPaymentEvent, liveOrder, startPayment, syncYoupiOrderStatus, switchOrderToCod, retryOrderPayment, guestToken } from "@/lib/international/orders";
import { market } from "@/lib/international/store";

describe("YoupiPaymentClient Unit Tests", () => {
  const secret = "test_webhook_secret_key_12345678";
  const client = new YoupiPaymentClient({
    apiUrl: "https://pay-api.biolastic.co.in",
    checkoutUrl: "https://pay.biolastic.co.in",
    adminUrl: "https://pay-admin.biolastic.co.in",
    merchantId: "test-merchant-001",
    apiKey: "test_api_key_abc",
    webhookSecret: secret,
  });

  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("initializes with normalized URLs and options", () => {
    expect(client.apiUrl).toBe("https://pay-api.biolastic.co.in");
    expect(client.checkoutUrl).toBe("https://pay.biolastic.co.in");
    expect(client.merchantId).toBe("test-merchant-001");
  });

  it("verifies valid HMAC-SHA256 webhook signatures", () => {
    const payload = JSON.stringify({
      event: "SUCCESS",
      deliveryId: "del_123",
      timestamp: Date.now(),
      paymentId: "pay_sess_456",
      orderId: "ord_789",
      amount: "499.00",
      amountPaise: 49900,
      currency: "INR",
    });

    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const verified = client.verifyWebhook(payload, `sha256=${signature}`);
    expect(verified.event).toBe("SUCCESS");
    expect(verified.paymentId).toBe("pay_sess_456");
  });

  it("verifies timestamp-prefixed HMAC-SHA256 signatures", () => {
    const timestamp = Date.now();
    const payload = JSON.stringify({
      event: "SUCCESS",
      deliveryId: "del_timestamped",
      timestamp,
      paymentId: "pay_sess_ts",
      orderId: "ord_ts",
      amount: "250.00",
      amountPaise: 25000,
      currency: "INR",
    });

    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    const verified = client.verifyWebhook(payload, signature, undefined, {
      timestampHeader: String(timestamp),
    });
    expect(verified.event).toBe("SUCCESS");
  });

  it("rejects tampered webhook payloads", () => {
    const payload = JSON.stringify({
      event: "SUCCESS",
      amountPaise: 50000,
      orderId: "ord_1",
    });
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const tampered = JSON.stringify({
      event: "SUCCESS",
      amountPaise: 10000,
      orderId: "ord_1",
    });

    expect(() => client.verifyWebhook(tampered, signature)).toThrow(
      "Webhook verification failed: Invalid HMAC-SHA256 signature."
    );
  });

  it("rejects missing signature header", () => {
    expect(() => client.verifyWebhook("{}", null)).toThrow(
      "Webhook verification failed: Missing X-Gateway-Signature header."
    );
  });

  it("creates payment session with expected schema", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: "sess_xyz123",
        orderId: "order_123",
        amount: "500.00",
        amountPaise: "50000",
        currency: "INR",
        status: "INITIATED",
        checkoutUrl: "https://pay.biolastic.co.in/checkout/sess_xyz123",
      }),
    });
    global.fetch = mockFetch;

    const res = await client.createPaymentSession({
      orderId: "order_123",
      amount: 500,
      currency: "INR",
      returnUrl: "https://teafloww.com/purchase/order_123",
      customer: { name: "Test User", phone: "+919876543210" },
    });

    expect(res.paymentId).toBe("sess_xyz123");
    expect(res.checkoutUrl).toContain("sess_xyz123");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://pay-api.biolastic.co.in/api/v1/payments",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Merchant-Id": "test-merchant-001",
          "X-Merchant-Key": "test_api_key_abc",
        }),
      })
    );
  });
});

describe("Admin Gateway Routing & Store Settings Tests", () => {
  beforeEach(() => {
    const db = getDb();
    db.prepare("DELETE FROM store_settings WHERE key LIKE 'gateway_%' OR key LIKE 'youpi_%'").run();
  });

  it("defaults to Razorpay for all streams", () => {
    expect(resolveActiveGateway("direct_purchase")).toBe("razorpay");
    expect(resolveActiveGateway("sample_kit")).toBe("razorpay");
    expect(resolveActiveGateway("subscription")).toBe("razorpay");
  });

  it("updates and resolves YouPI routing independently per stream", () => {
    const db = getDb();

    // Set sample_kit to youpi, keep others on razorpay
    db.prepare("INSERT INTO store_settings (key, value) VALUES ('gateway_sample_kit', 'youpi')").run();
    expect(resolveActiveGateway("direct_purchase")).toBe("razorpay");
    expect(resolveActiveGateway("sample_kit")).toBe("youpi");
    expect(resolveActiveGateway("subscription")).toBe("razorpay");

    // Set direct_purchase and subscription to youpi
    db.prepare("INSERT INTO store_settings (key, value) VALUES ('gateway_direct_purchase', 'youpi')").run();
    db.prepare("INSERT INTO store_settings (key, value) VALUES ('gateway_subscription', 'youpi')").run();
    expect(resolveActiveGateway("direct_purchase")).toBe("youpi");
    expect(resolveActiveGateway("sample_kit")).toBe("youpi");
    expect(resolveActiveGateway("subscription")).toBe("youpi");
  });

  it("falls back to Razorpay if YouPI is disabled globally", () => {
    const db = getDb();
    db.prepare("INSERT INTO store_settings (key, value) VALUES ('gateway_direct_purchase', 'youpi')").run();
    db.prepare("INSERT INTO store_settings (key, value) VALUES ('youpi_enabled', '0')").run();

    expect(resolveActiveGateway("direct_purchase")).toBe("razorpay");
  });

  it("masks secrets in getPaymentSettings and preserves existing on update", () => {
    updatePaymentSettings({
      payment_mode: "test",
      gateway_direct_purchase: "youpi",
      gateway_sample_kit: "razorpay",
      gateway_subscription: "youpi",
      youpi_enabled: true,
      youpi_api_url: "https://pay-api.biolastic.co.in",
      youpi_checkout_url: "https://pay.biolastic.co.in",
      youpi_admin_url: "https://pay-admin.biolastic.co.in",
      youpi_merchant_id: "00000000-0000-0000-0000-000000000001",
      youpi_api_token: "super_secret_token_123",
      youpi_webhook_secret: "super_webhook_secret_456",
      cod_enabled: true,
      cod_fee_rupees: 50,
      cod_min_rupees: 100,
      cod_max_rupees: 5000,
    });

    const settings = getPaymentSettings();
    expect(settings.gateway_direct_purchase).toBe("youpi");
    expect(settings.gateway_sample_kit).toBe("razorpay");
    expect(settings.gateway_subscription).toBe("youpi");
    expect(settings.youpi_api_token).toBe("••••••••••••");
    expect(settings.youpi_webhook_secret).toBe("••••••••••••");
    expect(settings.youpi_api_token_configured).toBe(true);
    expect(settings.youpi_webhook_configured).toBe(true);
    expect(settings.youpi_webhook_url).toContain("/api/webhooks/youpi");

    // Re-saving with masked placeholders does not overwrite actual stored secret
    updatePaymentSettings({
      ...settings,
      youpi_api_token: "••••••••••••",
      youpi_webhook_secret: "••••••••••••",
    });

    const db = getDb();
    const tokenRow = db.prepare("SELECT value FROM store_settings WHERE key = 'youpi_api_token'").get() as { value: string };
    expect(tokenRow.value).toBe("super_secret_token_123");
  });
});

describe("YouPI Webhook Order Processing", () => {
  const db = getDb();

  it("marks order paid upon SUCCESS webhook event", () => {
    const testOrderId = "order_test_youpi_" + Math.random().toString(36).slice(2);
    const testQuoteId = "quote_test_youpi_" + Math.random().toString(36).slice(2);
    const testPaymentId = "pay_sess_" + Math.random().toString(36).slice(2);
    const delId = "del_" + Math.random().toString(36).slice(2);

    db.prepare(`
      INSERT OR REPLACE INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES (?, 'test_owner', ?, ?)
    `).run(
      testQuoteId,
      JSON.stringify({
        id: testQuoteId,
        totalMinor: 49900,
        currency: "INR",
        items: [{ variantId: 1, quantity: 1, pricePaise: 49900 }],
        input: { address: { name: "Test Customer", phone: "+919876543210" }, method: "upi" },
      }),
      Date.now() + 3600000
    );

    db.prepare(`
      INSERT OR REPLACE INTO commerce_orders (
        id, owner, idempotency_key, quote_id, document, payment_status,
        fulfillment_status, gateway_order_id, reserved_until, inventory_status, refund_minor, created_ms
      ) VALUES (?, 'test_owner', ?, ?, ?, 'payment_pending', 'unfulfilled', ?, ?, 'reserved', 0, ?)
    `).run(
      testOrderId,
      "idem_" + testOrderId,
      testQuoteId,
      JSON.stringify({
        id: testQuoteId,
        totalMinor: 49900,
        currency: "INR",
        items: [{ variantId: 1, quantity: 1, pricePaise: 49900 }],
        input: { address: { name: "Test Customer", phone: "+919876543210" }, method: "upi" },
      }),
      testPaymentId,
      Date.now() + 3600000,
      Date.now()
    );

    const webhookEvent: YoupiWebhookEvent = {
      event: "SUCCESS",
      deliveryId: delId,
      timestamp: Date.now(),
      paymentId: testPaymentId,
      orderId: testOrderId,
      amount: "499.00",
      amountPaise: 49900,
      currency: "INR",
      method: "UPI",
      utr: "412345678901",
    };

    applyYoupiPaymentEvent(delId, webhookEvent);

    const order = liveOrder(testOrderId);
    expect(order.payment_status).toBe("paid");
    expect(order.gateway_payment_id).toBe(testPaymentId);

    // Duplicate webhook delivery is idempotent
    expect(() => applyYoupiPaymentEvent(delId, webhookEvent)).not.toThrow();
    expect(liveOrder(testOrderId).payment_status).toBe("paid");
  });

  it("marks order failed upon FAILED webhook event", () => {
    const failedOrderId = "order_test_failed_" + Math.random().toString(36).slice(2);
    const failedQuoteId = "quote_test_failed_" + Math.random().toString(36).slice(2);
    const failedPaymentId = "pay_fail_" + Math.random().toString(36).slice(2);
    const delId = "del_fail_" + Math.random().toString(36).slice(2);

    db.prepare(`
      INSERT OR REPLACE INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES (?, 'test_owner', ?, ?)
    `).run(
      failedQuoteId,
      JSON.stringify({ id: failedQuoteId, totalMinor: 35000, currency: "INR", items: [], input: { address: {}, method: "upi" } }),
      Date.now() + 3600000
    );

    db.prepare(`
      INSERT OR REPLACE INTO commerce_orders (
        id, owner, idempotency_key, quote_id, document, payment_status,
        fulfillment_status, gateway_order_id, reserved_until, inventory_status, refund_minor, created_ms
      ) VALUES (?, 'test_owner', ?, ?, ?, 'payment_pending', 'unfulfilled', ?, ?, 'reserved', 0, ?)
    `).run(
      failedOrderId,
      "idem_" + failedOrderId,
      failedQuoteId,
      JSON.stringify({ id: failedQuoteId, totalMinor: 35000, currency: "INR", items: [], input: { address: {}, method: "upi" } }),
      failedPaymentId,
      Date.now() + 3600000,
      Date.now()
    );

    const webhookEvent: YoupiWebhookEvent = {
      event: "FAILED",
      deliveryId: delId,
      timestamp: Date.now(),
      paymentId: failedPaymentId,
      orderId: failedOrderId,
      amount: "350.00",
      amountPaise: 35000,
      currency: "INR",
    };

    applyYoupiPaymentEvent(delId, webhookEvent);

    const order = liveOrder(failedOrderId);
    expect(order.payment_status).toBe("payment_failed");
  });
});

describe("Live YouPI Biolastic Connectivity", () => {
  it("connects to live pay-api.biolastic.co.in health endpoint", async () => {
    const client = new YoupiPaymentClient({
      apiUrl: "https://pay-api.biolastic.co.in",
      apiKey: "dbdb8fc885f6204541f67a58b600253a357c3c1c78f700841cbbc54c9bf63ac2",
    });

    const health = await client.checkHealth();
    expect(health.status).toBe("UP");
    expect(health.service).toBe("payment-api");
  });

  it("authenticates against live pay-api.biolastic.co.in admin settings", async () => {
    const client = new YoupiPaymentClient({
      apiUrl: "https://pay-api.biolastic.co.in",
      apiKey: "dbdb8fc885f6204541f67a58b600253a357c3c1c78f700841cbbc54c9bf63ac2",
    });

    const settings = await client.checkAdminSettings();
    expect(settings.merchantId).toBe("00000000-0000-0000-0000-000000000001");
  });
});

describe("Inbound Webhook HTTP Route Handler", () => {
  it("rejects request with invalid signature header with 401", async () => {
    const { POST } = await import("@/app/api/webhooks/youpi/route");
    const req = new Request("http://localhost:3000/api/webhooks/youpi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Signature": "sha256=invalid_hex_signature",
      },
      body: JSON.stringify({ event: "SUCCESS", orderId: "ord_1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("accepts valid signed webhook and returns 200", async () => {
    const { POST } = await import("@/app/api/webhooks/youpi/route");
    const db = getDb();
    const routeOrderId = "order_route_" + Date.now();
    const routeQuoteId = "quote_route_" + Date.now();

    db.prepare(`
      INSERT OR REPLACE INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES (?, 'test_owner', ?, ?)
    `).run(
      routeQuoteId,
      JSON.stringify({
        id: routeQuoteId,
        totalMinor: 50000,
        currency: "INR",
        items: [{ variantId: 1, quantity: 1, pricePaise: 50000 }],
        input: { address: { name: "Route Test", phone: "+919876543210" }, method: "upi" },
      }),
      Date.now() + 3600000
    );

    db.prepare(`
      INSERT OR REPLACE INTO commerce_orders (
        id, owner, idempotency_key, quote_id, document, payment_status,
        fulfillment_status, gateway_order_id, reserved_until, inventory_status, refund_minor, created_ms
      ) VALUES (?, 'test_owner', ?, ?, ?, 'payment_pending', 'unfulfilled', ?, ?, 'reserved', 0, ?)
    `).run(
      routeOrderId,
      "idem_" + routeOrderId,
      routeQuoteId,
      JSON.stringify({
        id: routeQuoteId,
        totalMinor: 50000,
        currency: "INR",
        items: [{ variantId: 1, quantity: 1, pricePaise: 50000 }],
        input: { address: { name: "Route Test", phone: "+919876543210" }, method: "upi" },
      }),
      "youpi_pay_sess_route",
      Date.now() + 3600000,
      Date.now()
    );

    const { getYoupiConfig } = await import("@/lib/youpi/config");
    const secret = getYoupiConfig().webhookSecret;
    const delId = "del_route_" + Math.random().toString(36).slice(2);
    const payload = JSON.stringify({
      event: "SUCCESS",
      deliveryId: delId,
      timestamp: Date.now(),
      paymentId: "youpi_pay_sess_route",
      orderId: routeOrderId,
      amount: "500.00",
      amountPaise: 50000,
      currency: "INR",
      method: "UPI",
    });

    const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const req = new Request("http://localhost:3000/api/webhooks/youpi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Signature": `sha256=${sig}`,
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);

    const updated = liveOrder(routeOrderId);
    expect(updated.payment_status).toBe("paid");
  });
});

describe("COD Gateway Bypass & COD Recovery Tests", () => {
  const db = getDb();

  beforeEach(() => {
    Object.assign(process.env, {
      RAZORPAY_KEY_ID: "rzp_test_local",
      RAZORPAY_KEY_SECRET: "test_secret",
      RAZORPAY_WEBHOOK_SECRET: "test_webhook_secret",
      SHIPROCKET_EMAIL: "test@example.com",
      SHIPROCKET_PASSWORD: "test_password",
      ORDER_ACCESS_SECRET: "test_order_secret_123456789012345678901234567890",
      SESSION_SECRET: "test_session_secret_123456789012345678901234567890",
    });
    // Ensure YouPI is active for direct purchase
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value) VALUES ('gateway_direct_purchase', 'youpi')").run();
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value) VALUES ('youpi_enabled', '1')").run();
  });

  it("never calls YouPI and returns gateway 'cod' when payment method is COD", async () => {
    const codQuoteId = "quote_cod_test_" + Math.random().toString(36).slice(2);
    const mockOwner = "owner_cod_test";

    const existing = db.prepare("SELECT id, price_paise, sku FROM variants WHERE stock >= 1 LIMIT 1").get() as { id: number; price_paise: number; sku: string } | undefined;
    let variantId = existing?.id;
    const pricePaise = existing?.price_paise || 49900;
    let sku = existing?.sku || "TEST-SKU-1";
    if (!variantId) {
      const prod = db.prepare("SELECT id FROM products LIMIT 1").get() as { id: number };
      const res = db.prepare("INSERT INTO variants (product_id, sku, grams, price_paise, stock) VALUES (?, 'TEST-COD-1', 100, 49900, 50)").run(prod.id);
      variantId = Number(res.lastInsertRowid);
      sku = "TEST-COD-1";
    }

    const quoteDoc = {
      id: codQuoteId,
      owner: mockOwner,
      marketVersion: market("IN").version,
      currency: "INR",
      rate: "1",
      expires: Date.now() + 900000,
      totalMinor: pricePaise + 5000,
      totalPaise: pricePaise + 5000,
      subtotalPaise: pricePaise,
      discountPaise: 0,
      shippingPaise: 0,
      taxPaise: 0,
      components: { merchandise: pricePaise, shipping: 0, duties: 0, tax: 0, cod: 5000 },
      lines: [{ variantId, quantity: 1, pricePaise, grams: 100, sku, name: "Test Tea" }],
      input: {
        address: {
          name: "COD Customer",
          phone: "+919876543210",
          email: "cod@example.com",
          line1: "123 Tea Lane",
          city: "Siliguri",
          state: "West Bengal",
          postcode: "734001",
          country: "IN",
        },
        method: "cod",
        currency: "INR",
        locale: "en",
        items: [{ variantId, quantity: 1 }],
      },
    };

    db.prepare(`
      INSERT OR REPLACE INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES (?, ?, ?, ?)
    `).run(codQuoteId, mockOwner, JSON.stringify(quoteDoc), Date.now() + 900000);

    const paymentResult = await startPayment(codQuoteId, mockOwner, "idem_cod_" + Date.now());

    expect(paymentResult.paymentStatus).toBe("cod_due");
    expect(paymentResult.gateway).toBe("cod");
    expect(paymentResult.checkoutUrl).toBeUndefined();
    expect(paymentResult.preferredMethod).toBe("cod");

    const savedOrder = liveOrder(paymentResult.orderId);
    expect(savedOrder.payment_status).toBe("cod_due");
    expect(savedOrder.gateway_order_id).toBeNull();
  });

  it("switches an online pending/failed order to Cash on Delivery", () => {
    const onlineOrderId = "order_switch_" + Math.random().toString(36).slice(2);
    const onlineQuoteId = "quote_switch_" + Math.random().toString(36).slice(2);
    const mockOwner = "owner_switch_test";

    const quoteDoc = {
      id: onlineQuoteId,
      owner: mockOwner,
      currency: "INR",
      rate: "1",
      expires: Date.now() + 900000,
      totalMinor: 49900,
      totalPaise: 49900,
      subtotalPaise: 49900,
      discountPaise: 0,
      shippingPaise: 0,
      taxPaise: 0,
      components: { merchandise: 49900, shipping: 0, duties: 0, tax: 0, cod: 0 },
      lines: [{ variantId: 99991, quantity: 1, pricePaise: 49900, grams: 100, sku: "TEST-SKU-99991", name: "Test Tea" }],
      input: {
        address: {
          name: "Switch Customer",
          phone: "+919876543210",
          email: "switch@example.com",
          line1: "456 Garden Road",
          city: "Siliguri",
          state: "West Bengal",
          postcode: "734001",
          country: "IN",
        },
        method: "upi",
        currency: "INR",
        locale: "en",
        items: [{ variantId: 99991, quantity: 1 }],
      },
    };

    db.prepare(`
      INSERT OR REPLACE INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES (?, ?, ?, ?)
    `).run(onlineQuoteId, mockOwner, JSON.stringify(quoteDoc), Date.now() + 3600000);

    db.prepare(`
      INSERT OR REPLACE INTO commerce_orders (
        id, owner, idempotency_key, quote_id, document, payment_status,
        fulfillment_status, gateway_order_id, reserved_until, inventory_status, refund_minor, created_ms
      ) VALUES (?, ?, ?, ?, ?, 'payment_failed', 'unfulfilled', 'youpi_failed_123', ?, 'reserved', 0, ?)
    `).run(
      onlineOrderId,
      mockOwner,
      "idem_" + onlineOrderId,
      onlineQuoteId,
      JSON.stringify(quoteDoc),
      Date.now() + 3600000,
      Date.now()
    );

    const token = guestToken(onlineOrderId);
    const updated = switchOrderToCod(onlineOrderId, token);

    expect(updated.payment_status).toBe("cod_due");
    expect(updated.inventory_status).toBe("allocated");
    expect(updated.gateway_order_id).toBeNull();

    const updatedDoc = JSON.parse(updated.document);
    expect(updatedDoc.input.method).toBe("cod");

    // Re-switching an already confirmed COD order is idempotent
    const again = switchOrderToCod(onlineOrderId, token);
    expect(again.payment_status).toBe("cod_due");
  });

  it("syncs order status with YouPI when payment succeeded on gateway", async () => {
    const syncOrderId = "order_sync_" + Math.random().toString(36).slice(2);
    const syncQuoteId = "quote_sync_" + Math.random().toString(36).slice(2);
    const youpiPaymentId = "youpi_sess_sync_" + Math.random().toString(36).slice(2);

    const quoteDoc = {
      id: syncQuoteId,
      currency: "INR",
      totalMinor: 49900,
      input: { address: { name: "Sync User", phone: "+919876543210" }, method: "upi" },
    };

    db.prepare(`
      INSERT OR REPLACE INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES (?, 'sync_owner', ?, ?)
    `).run(syncQuoteId, JSON.stringify(quoteDoc), Date.now() + 3600000);

    db.prepare(`
      INSERT OR REPLACE INTO commerce_orders (
        id, owner, idempotency_key, quote_id, document, payment_status,
        fulfillment_status, gateway_order_id, reserved_until, inventory_status, refund_minor, created_ms
      ) VALUES (?, 'sync_owner', ?, ?, ?, 'payment_pending', 'unfulfilled', ?, ?, 'reserved', 0, ?)
    `).run(
      syncOrderId,
      "idem_" + syncOrderId,
      syncQuoteId,
      JSON.stringify(quoteDoc),
      youpiPaymentId,
      Date.now() + 3600000,
      Date.now()
    );

    // Mock YoupiPaymentClient.getPaymentSession returning SUCCESS
    const origFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: youpiPaymentId,
        orderId: syncOrderId,
        amount: "499.00",
        amountPaise: "49900",
        currency: "INR",
        status: "SUCCESS",
        method: "UPI",
      }),
    });

    try {
      const order = liveOrder(syncOrderId);
      const synced = await syncYoupiOrderStatus(order);
      expect(synced.payment_status).toBe("paid");
      expect(synced.gateway_payment_id).toBe(youpiPaymentId);
    } finally {
      global.fetch = origFetch;
    }
  });

  it("syncs order status to payment_failed when YouPI session was cancelled/failed", async () => {
    const failSyncId = "order_fail_sync_" + Math.random().toString(36).slice(2);
    const failQuoteId = "quote_fail_sync_" + Math.random().toString(36).slice(2);
    const failSessId = "youpi_sess_failed_" + Math.random().toString(36).slice(2);

    const quoteDoc = { id: failQuoteId, currency: "INR", totalMinor: 30000, input: { method: "upi" } };

    db.prepare(`
      INSERT OR REPLACE INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES (?, 'owner', ?, ?)
    `).run(failQuoteId, JSON.stringify(quoteDoc), Date.now() + 3600000);

    db.prepare(`
      INSERT OR REPLACE INTO commerce_orders (
        id, owner, idempotency_key, quote_id, document, payment_status,
        fulfillment_status, gateway_order_id, reserved_until, inventory_status, refund_minor, created_ms
      ) VALUES (?, 'owner', ?, ?, ?, 'payment_pending', 'unfulfilled', ?, ?, 'reserved', 0, ?)
    `).run(
      failSyncId,
      "idem_" + failSyncId,
      failQuoteId,
      JSON.stringify(quoteDoc),
      failSessId,
      Date.now() + 3600000,
      Date.now()
    );

    const origFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: failSessId,
        orderId: failSyncId,
        amount: "300.00",
        amountPaise: "30000",
        currency: "INR",
        status: "CANCELLED",
      }),
    });

    try {
      const order = liveOrder(failSyncId);
      const synced = await syncYoupiOrderStatus(order);
      expect(synced.payment_status).toBe("payment_failed");
    } finally {
      global.fetch = origFetch;
    }
  });

  it("retries payment by creating a fresh YouPI payment session", async () => {
    const retryOrderId = "order_retry_" + Math.random().toString(36).slice(2);
    const retryQuoteId = "quote_retry_" + retryOrderId;
    const quoteDoc = {
      id: retryQuoteId,
      currency: "INR",
      totalMinor: 49900,
      input: { address: { name: "Retry User", email: "retry@test.com", phone: "+919876543210" }, method: "upi" },
    };

    db.prepare(`
      INSERT OR REPLACE INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES (?, 'owner', ?, ?)
    `).run(retryQuoteId, JSON.stringify(quoteDoc), Date.now() + 3600000);

    db.prepare(`
      INSERT OR REPLACE INTO commerce_orders (
        id, owner, idempotency_key, quote_id, document, payment_status,
        fulfillment_status, gateway_order_id, reserved_until, inventory_status, refund_minor, created_ms
      ) VALUES (?, 'owner', ?, ?, ?, 'payment_failed', 'unfulfilled', 'old_youpi_sess', ?, 'reserved', 0, ?)
    `).run(
      retryOrderId,
      "idem_" + retryOrderId,
      retryQuoteId,
      JSON.stringify(quoteDoc),
      Date.now() + 3600000,
      Date.now()
    );

    const newSessId = "new_youpi_sess_" + Math.random().toString(36).slice(2);
    const origFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: newSessId,
        orderId: retryOrderId,
        amount: "499.00",
        amountPaise: "49900",
        currency: "INR",
        status: "INITIATED",
        checkoutUrl: `https://pay.biolastic.co.in/checkout/${newSessId}`,
      }),
    });

    try {
      const token = guestToken(retryOrderId);
      const result = await retryOrderPayment(retryOrderId, token);
      expect(result.gateway).toBe("youpi");
      expect(result.checkoutUrl).toContain(newSessId);

      const reloaded = liveOrder(retryOrderId);
      expect(reloaded.payment_status).toBe("payment_pending");
      expect(reloaded.gateway_order_id).toBe(newSessId);
    } finally {
      global.fetch = origFetch;
    }
  });

  it("handles change-to-cod via HTTP commerce action route", async () => {
    const { POST } = await import("@/app/api/commerce/[action]/route");
    const testOrderId = randomUUID();
    const testQuoteId = randomUUID();

    const quoteDoc = {
      id: testQuoteId,
      owner: "route_test_user",
      currency: "INR",
      rate: "1",
      expires: Date.now() + 900000,
      totalMinor: 49900,
      totalPaise: 49900,
      subtotalPaise: 49900,
      discountPaise: 0,
      shippingPaise: 0,
      taxPaise: 0,
      components: { merchandise: 49900, shipping: 0, duties: 0, tax: 0, cod: 0 },
      lines: [],
      input: {
        address: {
          name: "Route Switch",
          phone: "+919876543210",
          email: "routeswitch@test.com",
          line1: "789 Hill Rd",
          city: "Siliguri",
          state: "West Bengal",
          postcode: "734001",
          country: "IN",
        },
        method: "upi",
        currency: "INR",
        locale: "en",
        items: [],
      },
    };

    db.prepare(`
      INSERT OR REPLACE INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES (?, 'route_test_user', ?, ?)
    `).run(testQuoteId, JSON.stringify(quoteDoc), Date.now() + 3600000);

    db.prepare(`
      INSERT OR REPLACE INTO commerce_orders (
        id, owner, idempotency_key, quote_id, document, payment_status,
        fulfillment_status, gateway_order_id, reserved_until, inventory_status, refund_minor, created_ms
      ) VALUES (?, 'route_test_user', ?, ?, ?, 'payment_failed', 'unfulfilled', 'youpi_123', ?, 'reserved', 0, ?)
    `).run(
      testOrderId,
      "idem_" + testOrderId,
      testQuoteId,
      JSON.stringify(quoteDoc),
      Date.now() + 3600000,
      Date.now()
    );

    const token = guestToken(testOrderId);
    const req = new Request("http://localhost:3000/api/commerce/change-to-cod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: testOrderId, token }),
    });

    const res = await POST(req, { params: Promise.resolve({ action: "change-to-cod" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.paymentStatus).toBe("cod_due");

    const reloaded = liveOrder(testOrderId);
    expect(reloaded.payment_status).toBe("cod_due");
  });

  it("actively syncs YouPI status via GET /api/commerce/order", async () => {
    const { GET } = await import("@/app/api/commerce/[action]/route");
    const testOrderId = randomUUID();
    const testQuoteId = randomUUID();
    const youpiPaymentId = "youpi_sess_get_sync_" + Math.random().toString(36).slice(2);

    const quoteDoc = {
      id: testQuoteId,
      currency: "INR",
      totalMinor: 49900,
      input: { address: { name: "Get Sync", phone: "+919876543210" }, method: "upi" },
    };

    db.prepare(`
      INSERT OR REPLACE INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES (?, 'sync_get_user', ?, ?)
    `).run(testQuoteId, JSON.stringify(quoteDoc), Date.now() + 3600000);

    db.prepare(`
      INSERT OR REPLACE INTO commerce_orders (
        id, owner, idempotency_key, quote_id, document, payment_status,
        fulfillment_status, gateway_order_id, reserved_until, inventory_status, refund_minor, created_ms
      ) VALUES (?, 'sync_get_user', ?, ?, ?, 'payment_pending', 'unfulfilled', ?, ?, 'reserved', 0, ?)
    `).run(
      testOrderId,
      "idem_" + testOrderId,
      testQuoteId,
      JSON.stringify(quoteDoc),
      youpiPaymentId,
      Date.now() + 3600000,
      Date.now()
    );

    const origFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: youpiPaymentId,
        orderId: testOrderId,
        amount: "499.00",
        amountPaise: "49900",
        currency: "INR",
        status: "SUCCESS",
        method: "UPI",
      }),
    });

    try {
      const token = guestToken(testOrderId);
      const req = new Request(`http://localhost:3000/api/commerce/order?id=${testOrderId}&token=${encodeURIComponent(token)}`);
      const res = await GET(req, { params: Promise.resolve({ action: "order" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.paymentStatus).toBe("paid");

      const reloaded = liveOrder(testOrderId);
      expect(reloaded.payment_status).toBe("paid");
    } finally {
      global.fetch = origFetch;
    }
  });
});
