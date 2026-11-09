import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb } from "@/lib/db";
import {
  listCustomerOrders,
  getCustomerOrderDetails,
  cancelCustomerOrder,
  CustomerOrderError,
} from "@/lib/customerOrders";
import { randomUUID } from "node:crypto";

describe("Customer Orders & Self-Service Cancellation", () => {
  const customerId = randomUUID();
  const email = `order-test.${Date.now()}@teafloww.com`;
  const phone = "+91 98765 99999";

  beforeEach(() => {
    const db = getDb();
    db.prepare(
      "INSERT OR IGNORE INTO customers (id, email, phone, name) VALUES (?, ?, ?, 'Order Tester')"
    ).run(customerId, email, phone);
  });

  afterEach(() => {
    const db = getDb();
    db.prepare("DELETE FROM payment_events WHERE order_id IN (SELECT id FROM orders WHERE customer_email = ?)").run(email);
    db.prepare("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_email = ?)").run(email);
    db.prepare("DELETE FROM orders WHERE customer_email = ?").run(email);
    db.prepare("DELETE FROM customers WHERE id = ?").run(customerId);
  });

  it("lists orders belonging to customer by customer_id or matching email/phone", () => {
    const db = getDb();
    const order1Id = randomUUID();
    const order2Id = randomUUID();

    // Order with customer_id
    db.prepare(
      `INSERT INTO orders (id, customer_id, idempotency_key, customer_name, customer_email, customer_phone, shipping_address, subtotal_paise, shipping_paise, total_paise, status, dispatch_status)
       VALUES (?, ?, ?, 'Order Tester', ?, ?, 'Siliguri, WB', 45000, 0, 45000, 'demo_unpaid', 'unfulfilled')`
    ).run(order1Id, customerId, randomUUID(), email, phone);

    // Order without customer_id but with matching email
    db.prepare(
      `INSERT INTO orders (id, customer_id, idempotency_key, customer_name, customer_email, customer_phone, shipping_address, subtotal_paise, shipping_paise, total_paise, status, dispatch_status)
       VALUES (?, NULL, ?, 'Order Tester', ?, NULL, 'Siliguri, WB', 80000, 0, 80000, 'demo_unpaid', 'preparing')`
    ).run(order2Id, randomUUID(), email);

    const orders = listCustomerOrders(customerId, email, phone);
    expect(orders.length).toBeGreaterThanOrEqual(2);

    const found1 = orders.find((o) => o.id === order1Id);
    const found2 = orders.find((o) => o.id === order2Id);
    expect(found1).toBeDefined();
    expect(found2).toBeDefined();
    expect(found1?.is_cancellable).toBe(true);
  });

  it("retrieves full order details and packaging dossier", () => {
    const db = getDb();
    const orderId = randomUUID();

    db.prepare(
      "INSERT OR IGNORE INTO coupons (code, kind, value, min_subtotal_paise, is_active) VALUES ('TEAFIRST', 'percent', 10, 0, 1)"
    ).run();

    db.prepare(
      `INSERT INTO orders (id, customer_id, idempotency_key, customer_name, customer_email, customer_phone, shipping_address, subtotal_paise, shipping_paise, total_paise, status, dispatch_status, payment_status, coupon_code, discount_paise, tax_paise)
       VALUES (?, ?, ?, 'Order Tester', ?, ?, 'Works 00, Fulbari, Siliguri', 120000, 0, 100000, 'paid', 'preparing', 'paid', 'TEAFIRST', 20000, 5000)`
    ).run(orderId, customerId, randomUUID(), email, phone);

    const dossier = getCustomerOrderDetails(customerId, email, phone, orderId);
    expect(dossier.id).toBe(orderId);
    expect(dossier.customer_name).toBe("Order Tester");
    expect(dossier.coupon_code).toBe("TEAFIRST");
    expect(dossier.discount_paise).toBe(20000);
    expect(dossier.payment_status).toBe("paid");
  });

  it("cancels an eligible unshipped order and updates status", () => {
    const db = getDb();
    const orderId = randomUUID();

    // Pick an existing variant from the database to test stock restoration
    const targetVariant = db
      .prepare("SELECT id, stock FROM variants WHERE stock > 5 LIMIT 1")
      .get() as { id: number; stock: number };
    const variantId = targetVariant.id;
    const initialStock = targetVariant.stock;

    // Create order with 2 units of this variant
    db.prepare(
      `INSERT INTO orders (id, customer_id, idempotency_key, customer_name, customer_email, customer_phone, shipping_address, subtotal_paise, shipping_paise, total_paise, status, dispatch_status)
       VALUES (?, ?, ?, 'Order Tester', ?, ?, 'Siliguri, WB', 100000, 0, 100000, 'demo_unpaid', 'unfulfilled')`
    ).run(orderId, customerId, randomUUID(), email, phone);

    db.prepare(
      "INSERT INTO order_items (order_id, variant_id, quantity, unit_price_paise) VALUES (?, ?, 2, 50000)"
    ).run(orderId, variantId);

    // Cancel the order
    const cancelled = cancelCustomerOrder(
      customerId,
      email,
      phone,
      orderId,
      "Ordered wrong tea"
    );

    expect(cancelled.dispatch_status).toBe("cancelled");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.is_cancellable).toBe(false);

    // Verify stock is restored (+2)
    const varRow = db.prepare("SELECT stock FROM variants WHERE id = ?").get(variantId) as {
      stock: number;
    };
    expect(varRow.stock).toBe(initialStock + 2);

    // Restore original stock and cleanup test order
    db.prepare("UPDATE variants SET stock = ? WHERE id = ?").run(initialStock, variantId);
    db.prepare("DELETE FROM payment_events WHERE order_id = ?").run(orderId);
    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);
    db.prepare("DELETE FROM orders WHERE id = ?").run(orderId);
  });

  it("prevents cancellation of an order that has already shipped", () => {
    const db = getDb();
    const orderId = randomUUID();

    db.prepare(
      `INSERT INTO orders (id, customer_id, idempotency_key, customer_name, customer_email, customer_phone, shipping_address, subtotal_paise, shipping_paise, total_paise, status, dispatch_status)
       VALUES (?, ?, ?, 'Order Tester', ?, ?, 'Siliguri, WB', 50000, 0, 50000, 'paid', 'shipped')`
    ).run(orderId, customerId, randomUUID(), email, phone);

    expect(() =>
      cancelCustomerOrder(customerId, email, phone, orderId, "Changed mind")
    ).toThrow(CustomerOrderError);
  });

  it("lists and retrieves commerce_orders by UUID, 8-char reference, and TF- prefix", () => {
    const db = getDb();
    const commOrderId = randomUUID();
    const refCode = commOrderId.slice(0, 8).toUpperCase();

    const doc = {
      id: randomUUID(),
      owner: customerId,
      input: {
        address: {
          name: "Tea Connoisseur",
          email: email,
          phone: phone,
          line1: "Heritage Estate Bungalow",
          city: "Siliguri",
          state: "West Bengal",
          postcode: "734001",
          country: "IN",
        },
        method: "cod",
      },
      lines: [
        {
          variantId: 1,
          quantity: 2,
          pricePaise: 19900,
          grams: 50,
          sku: "DJ-SP-50",
          name: "Darjeeling Spring Clonal First Flush",
        },
      ],
      totalPaise: 39800,
      totalMinor: 39800,
      components: {
        merchandise: 39800,
        shipping: 0,
      },
    };

    const quoteId = randomUUID();
    db.prepare(`
      INSERT INTO commerce_quotes (id, owner, document, expires_ms)
      VALUES (?, ?, ?, ?)
    `).run(quoteId, customerId, JSON.stringify(doc), Date.now() + 600000);

    db.prepare(`
      INSERT INTO commerce_orders (id, owner, idempotency_key, quote_id, document, payment_status, fulfillment_status, reserved_until, created_ms)
      VALUES (?, ?, ?, ?, ?, 'cod_due', 'unfulfilled', ?, ?)
    `).run(commOrderId, customerId, randomUUID(), quoteId, JSON.stringify(doc), Date.now() + 600000, Date.now());

    // 1. List customer orders should include this commerce order
    const list = listCustomerOrders(customerId, email, phone);
    const found = list.find((o) => o.id === commOrderId);
    expect(found).toBeDefined();
    expect(found?.status).toBe("confirmed");
    expect(found?.payment_status).toBe("cod_due");
    expect(found?.reference).toBe(refCode);
    expect(found?.item_count).toBe(2);

    // 2. Retrieve by full UUID
    const detailsByUuid = getCustomerOrderDetails(customerId, email, phone, commOrderId);
    expect(detailsByUuid.id).toBe(commOrderId);
    expect(detailsByUuid.customer_email).toBe(email);
    expect(detailsByUuid.items.length).toBe(1);

    // 3. Retrieve by 8-char prefix
    const detailsByPrefix = getCustomerOrderDetails(customerId, email, phone, commOrderId.slice(0, 8));
    expect(detailsByPrefix.id).toBe(commOrderId);

    // 4. Retrieve by TF- prefixed reference
    const detailsByTf = getCustomerOrderDetails(customerId, email, phone, `TF-${refCode}`);
    expect(detailsByTf.id).toBe(commOrderId);

    // 5. Test cancelling commerce order
    const cancelled = cancelCustomerOrder(customerId, email, phone, commOrderId, "Customer request");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.dispatch_status).toBe("cancelled");
    expect(cancelled.is_cancellable).toBe(false);

    // Cleanup
    db.prepare("DELETE FROM commerce_events WHERE id LIKE ?").run(`cancel:${commOrderId}%`);
    db.prepare("DELETE FROM commerce_orders WHERE id = ?").run(commOrderId);
    db.prepare("DELETE FROM commerce_quotes WHERE id = ?").run(quoteId);
  });
});
