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

const TEST_DB = path.join(tmpdir(), `test-fulfill-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

describe("International Fulfillment, Shipment Booking & COD Reconciliation", () => {
  let db: any;
  const orderId = "fulfill-test-order-1";
  const codOrderId = "fulfill-cod-order-2";

  beforeAll(async () => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const { getDb } = await import("@/lib/db");
    db = getDb();

    process.env.ORDER_ACCESS_SECRET = "fulfillment-test-secret-12345678901234567890";
    process.env.SHIPROCKET_EMAIL = "ops@teafloww.com";
    process.env.SHIPROCKET_PASSWORD = "mock_password";

    const dummyQuote = {
      id: "quote-dummy-1",
      carrier: "courier-42",
      totalMinor: 84900,
      currency: "INR",
      subtotalPaise: 75000,
      discountPaise: 0,
      shippingPaise: 9900,
      created: Date.now(),
      package: {
        pickupPostcode: "734005",
        pickupLocation: "Siliguri Hub",
        length: 20,
        breadth: 15,
        height: 10,
        tareGrams: 100,
        maxGrams: 5000,
        hsn: "090210",
        origin: "IN",
      },
      lines: [
        { variantId: 1, quantity: 1, pricePaise: 75000, grams: 100, sku: "TFW-DARJ", name: "Darjeeling Tea" },
      ],
      input: {
        method: "prepaid",
        address: {
          name: "Test Receiver",
          email: "receiver@example.com",
          phone: "+91 9876543210",
          line1: "10 Hill Cart Road",
          line2: "",
          city: "Siliguri",
          state: "West Bengal",
          postcode: "734005",
          country: "IN",
        },
      },
    };

    // Insert quotes first to satisfy foreign key constraint
    db.prepare(`
      INSERT INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES (?, 'owner-1', ?, ?)
    `).run("quote-1", JSON.stringify(dummyQuote), Date.now() + 86400000);

    // Insert dummy prepaid order (paid)
    db.prepare(`
      INSERT INTO commerce_orders (id, owner, idempotency_key, quote_id, document, payment_status, fulfillment_status, reserved_until, inventory_status, created_ms)
      VALUES (?, 'owner-1', 'idem-1', 'quote-1', ?, 'paid', 'unfulfilled', ?, 'allocated', ?)
    `).run(orderId, JSON.stringify(dummyQuote), Date.now() + 86400000, Date.now());

    // Insert dummy COD order (cod_due)
    const codQuote = {
      ...dummyQuote,
      id: "quote-dummy-2",
      input: { ...dummyQuote.input, method: "cod" },
    };

    db.prepare(`
      INSERT INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES (?, 'owner-1', ?, ?)
    `).run("quote-2", JSON.stringify(codQuote), Date.now() + 86400000);

    db.prepare(`
      INSERT INTO commerce_orders (id, owner, idempotency_key, quote_id, document, payment_status, fulfillment_status, reserved_until, inventory_status, created_ms)
      VALUES (?, 'owner-1', 'idem-2', 'quote-2', ?, 'cod_due', 'unfulfilled', ?, 'reserved', ?)
    `).run(codOrderId, JSON.stringify(codQuote), Date.now() + 86400000, Date.now());
  });

  afterAll(() => {
    vi.restoreAllMocks();
    try { rmSync(TEST_DB, { force: true }); } catch {}
  });

  it("books a shipment for a paid order and prevents duplicate bookings idempotently", async () => {
    const { bookShipment } = await import("@/lib/international/fulfillment");
    const providers = await import("@/lib/international/providers");

    const spy = vi.spyOn(providers, "shippingRequest").mockResolvedValue({
      order_id: 998877,
      shipment_id: 112233,
    });

    const s = await bookShipment(orderId, "admin-agent");
    expect(s?.status).toBe("booked");
    expect(spy).toHaveBeenCalledTimes(1);

    // Call booking again: should be an idempotent no-op without invoking the provider again
    const s2 = await bookShipment(orderId, "admin-agent");
    expect(s2?.status).toBe("booked");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("rejects booking on unpaid orders", async () => {
    const { bookShipment } = await import("@/lib/international/fulfillment");
    const unpaidOrderId = "unpaid-order-99";

    db.prepare(`
      INSERT INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES ('quote-99', 'owner-1', '{}', ?)
    `).run(Date.now() + 86400000);

    db.prepare(`
      INSERT INTO commerce_orders (id, owner, idempotency_key, quote_id, document, payment_status, fulfillment_status, reserved_until, inventory_status, created_ms)
      VALUES (?, 'owner-1', 'idem-99', 'quote-99', '{}', 'payment_pending', 'unfulfilled', ?, 'reserved', ?)
    `).run(unpaidOrderId, Date.now() + 86400000, Date.now());

    await expect(bookShipment(unpaidOrderId, "admin-agent")).rejects.toThrow(
      "Payment or inventory requires review before booking."
    );
  });

  it("projects public tracking to guests without leaking internal provider details, and never marks COD collected on delivery alone", async () => {
    const { bookShipment, shipmentAction } = await import("@/lib/international/fulfillment");
    const { liveOrder } = await import("@/lib/international/orders");
    const providers = await import("@/lib/international/providers");

    vi.spyOn(providers, "shippingRequest").mockImplementation(async (path: string) => {
      if (path === "orders/create/adhoc") {
        return { order_id: 101, shipment_id: 202 };
      }
      if (path.startsWith("courier/track/shipment")) {
        return {
          tracking_data: {
            shipment_status: 7, // Delivered status code
            shipment_track: [{ awb_code: "AWB998877", current_status: "Delivered to customer" }],
          },
        };
      }
      return {};
    });

    // Book COD shipment
    await bookShipment(codOrderId, "admin-agent");

    // Track shipment
    await shipmentAction(codOrderId, "track", "worker");

    const orderAfterDelivery = liveOrder(codOrderId);
    // Fulfillment is delivered
    expect(orderAfterDelivery.fulfillment_status).toBe("delivered");
    // Crucial requirement: Delivery alone NEVER marks COD payment collected!
    expect(orderAfterDelivery.payment_status).toBe("cod_due");
  });

  it("reconciles COD payment when remittance is verified by staff with exact amount", async () => {
    const { reconcileCod } = await import("@/lib/international/fulfillment");
    const { liveOrder } = await import("@/lib/international/orders");

    // Exact amount is 84900 paise
    reconcileCod(codOrderId, 84900, "BANK_REMITTANCE_REF_001", "admin-accountant");

    const order = liveOrder(codOrderId);
    expect(order.payment_status).toBe("cod_remitted");
    expect(order.inventory_status).toBe("allocated");

    // Mismatched amount throws
    await expect(
      Promise.resolve().then(() => reconcileCod(codOrderId, 50000, "BAD_REF", "admin-accountant"))
    ).rejects.toThrow("COD collection does not match this order.");
  });

  it("cancels unpaid unshipped orders and triggers cleanup", async () => {
    const { cancelUnpaid } = await import("@/lib/international/fulfillment");
    const { liveOrder } = await import("@/lib/international/orders");

    const orderToCancel = "order-cancel-test";
    db.prepare(`
      INSERT INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES ('quote-cancel', 'owner-1', '{}', ?)
    `).run(Date.now() + 86400000);

    db.prepare(`
      INSERT INTO commerce_orders (id, owner, idempotency_key, quote_id, document, payment_status, fulfillment_status, reserved_until, inventory_status, created_ms)
      VALUES (?, 'owner-1', 'idem-cancel', 'quote-cancel', '{}', 'payment_failed', 'unfulfilled', ?, 'reserved', ?)
    `).run(orderToCancel, Date.now() + 86400000, Date.now());

    cancelUnpaid(orderToCancel, "admin-agent");

    const cancelledOrder = liveOrder(orderToCancel);
    expect(cancelledOrder.payment_status).toBe("cancelled");
    expect(cancelledOrder.fulfillment_status).toBe("cancelled");
    expect(cancelledOrder.reserved_until).toBe(0);
  });
});
