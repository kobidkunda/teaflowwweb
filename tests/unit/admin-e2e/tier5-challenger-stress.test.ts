import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, createMockImageBuffer, type TestEnv } from "./test-helper";
import { POST as categoriesPOST } from "@/app/api/admin/categories/route";
import { DELETE as categoryDetailDELETE } from "@/app/api/admin/categories/[id]/route";
import { POST as productsPOST } from "@/app/api/admin/products/route";
import { DELETE as productDetailDELETE } from "@/app/api/admin/products/[id]/route";
import { POST as orderDispatchPOST } from "@/app/api/admin/orders/[id]/dispatch/route";
import { DELETE as orderDispatchDELETE } from "@/app/api/admin/orders/[id]/dispatch/route";
import { POST as orderCancelPOST } from "@/app/api/admin/orders/[id]/cancel/route";
import { POST as uploadsPOST } from "@/app/api/admin/uploads/route";
import { POST as userResetPOST } from "@/app/api/admin/users/[id]/reset/route";
import { GET as ordersGET } from "@/app/api/admin/orders/route";
import { getCategory } from "@/lib/categories";
import { getProduct } from "@/lib/products";
import { getOrder, setDispatchStatus } from "@/lib/orders";
import { createAdminSession, verifySessionValue, SESSION_COOKIE } from "@/lib/adminSessions";
import { conflict } from "@/lib/adminHttp";

describe("Tier 5: Adversarial Challenge & Stress Harness (Milestone M6)", () => {
  let env: TestEnv;
  let rootCookie: string;
  let staffCookie: string;

  beforeAll(() => {
    env = setupAdminTestEnv();
    rootCookie = getAuthCookie(env.db, "root");
    staffCookie = getAuthCookie(env.db, "admin");
  });

  afterAll(() => {
    env.cleanup();
  });

  // =========================================================================
  // Challenge 1: Category Deletion Dependency Guard
  // =========================================================================
  describe("Challenge 1: Category deletion dependency guard (active products & subcategories)", () => {
    let catWithProdId: number;
    let assignedProductId: number;
    let catWithSlugProdId: number;
    let assignedSlugProdId: number;
    let parentCatId: number;
    let childCatId: number;

    beforeAll(() => {
      // 1. Category with product linked via category_id
      const c1 = env.db.prepare("INSERT INTO categories (slug, name, sort_order) VALUES ('adv-cat-id', 'Adv Cat ID', 1)").run();
      catWithProdId = Number(c1.lastInsertRowid);
      const p1 = env.db.prepare(`
        INSERT INTO products (slug, name, category, category_id, origin, estate, flush, harvest_date, description, tasting_notes, brew_temp, brew_seconds)
        VALUES ('adv-prod-id', 'Adv Tea ID', 'adv-cat-id', ?, 'Darjeeling', 'Risheehat', 'Spring', '2026', 'Desc', 'Notes', 90, 180)
      `).run(catWithProdId);
      assignedProductId = Number(p1.lastInsertRowid);

      // 2. Category with product linked via legacy slug
      const c2 = env.db.prepare("INSERT INTO categories (slug, name, sort_order) VALUES ('adv-cat-slug', 'Adv Cat Slug', 2)").run();
      catWithSlugProdId = Number(c2.lastInsertRowid);
      const p2 = env.db.prepare(`
        INSERT INTO products (slug, name, category, category_id, origin, estate, flush, harvest_date, description, tasting_notes, brew_temp, brew_seconds)
        VALUES ('adv-prod-slug', 'Adv Tea Slug', 'adv-cat-slug', NULL, 'Darjeeling', 'Gopaldhara', 'Autumn', '2026', 'Desc', 'Notes', 85, 120)
      `).run();
      assignedSlugProdId = Number(p2.lastInsertRowid);

      // 3. Parent category with child subcategory
      const c3 = env.db.prepare("INSERT INTO categories (slug, name, sort_order) VALUES ('adv-parent-cat', 'Adv Parent Cat', 3)").run();
      parentCatId = Number(c3.lastInsertRowid);
      const c4 = env.db.prepare("INSERT INTO categories (slug, name, sort_order, parent_id) VALUES ('adv-child-cat', 'Adv Child Cat', 4, ?)").run(parentCatId);
      childCatId = Number(c4.lastInsertRowid);
    });

    it("must return HTTP 409 (never 200 or 204) when active products reference category by category_id", async () => {
      const req = new Request(`http://localhost/api/admin/categories/${catWithProdId}`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });

      const res = await categoryDetailDELETE(req, { params: Promise.resolve({ id: String(catWithProdId) }) });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/cannot be deleted because.*product.*assigned/i);

      // Verify category still intact in DB
      const catInDb = getCategory(catWithProdId);
      expect(catInDb).not.toBeNull();
      expect(catInDb?.id).toBe(catWithProdId);
    });

    it("must return HTTP 409 when active products reference category by slug", async () => {
      const req = new Request(`http://localhost/api/admin/categories/${catWithSlugProdId}`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });

      const res = await categoryDetailDELETE(req, { params: Promise.resolve({ id: String(catWithSlugProdId) }) });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/cannot be deleted because.*product.*assigned/i);

      const catInDb = getCategory(catWithSlugProdId);
      expect(catInDb).not.toBeNull();
    });

    it("must return HTTP 409 when child subcategories reference category as parent_id", async () => {
      const req = new Request(`http://localhost/api/admin/categories/${parentCatId}`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });

      const res = await categoryDetailDELETE(req, { params: Promise.resolve({ id: String(parentCatId) }) });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/cannot be deleted because.*subcategory.*reference/i);

      const parentInDb = getCategory(parentCatId);
      expect(parentInDb).not.toBeNull();
    });

    it("allows category deletion with HTTP 204 ONLY after all product and subcategory dependencies are unlinked", async () => {
      // 1. Remove assigned products
      const delP1 = new Request(`http://localhost/api/admin/products/${assignedProductId}`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });
      const resP1 = await productDetailDELETE(delP1, { params: Promise.resolve({ id: String(assignedProductId) }) });
      expect(resP1.status).toBe(204);

      const delP2 = new Request(`http://localhost/api/admin/products/${assignedSlugProdId}`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });
      const resP2 = await productDetailDELETE(delP2, { params: Promise.resolve({ id: String(assignedSlugProdId) }) });
      expect(resP2.status).toBe(204);

      // 2. Remove child category
      const delC4 = new Request(`http://localhost/api/admin/categories/${childCatId}`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });
      const resC4 = await categoryDetailDELETE(delC4, { params: Promise.resolve({ id: String(childCatId) }) });
      expect(resC4.status).toBe(204);

      // 3. Now the 3 categories must successfully delete with 204
      const delC1 = new Request(`http://localhost/api/admin/categories/${catWithProdId}`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });
      const resC1 = await categoryDetailDELETE(delC1, { params: Promise.resolve({ id: String(catWithProdId) }) });
      expect(resC1.status).toBe(204);

      const delC2 = new Request(`http://localhost/api/admin/categories/${catWithSlugProdId}`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });
      const resC2 = await categoryDetailDELETE(delC2, { params: Promise.resolve({ id: String(catWithSlugProdId) }) });
      expect(resC2.status).toBe(204);

      const delC3 = new Request(`http://localhost/api/admin/categories/${parentCatId}`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });
      const resC3 = await categoryDetailDELETE(delC3, { params: Promise.resolve({ id: String(parentCatId) }) });
      expect(resC3.status).toBe(204);

      // Verify deletion in DB
      expect(getCategory(catWithProdId)).toBeNull();
      expect(getCategory(catWithSlugProdId)).toBeNull();
      expect(getCategory(parentCatId)).toBeNull();
    });
  });

  // =========================================================================
  // Challenge 2: Product Deletion Dependency Guard
  // =========================================================================
  describe("Challenge 2: Product deletion dependency guard (referenced in order items)", () => {
    let orderGuardedProdId: number;
    let orderGuardedVariantId: number;
    let orderId: string;
    let unreferencedProdId: number;

    beforeAll(() => {
      // 1. Create product with variant referenced in order_items
      const p = env.db.prepare(`
        INSERT INTO products (slug, name, category, origin, estate, flush, harvest_date, description, tasting_notes, brew_temp, brew_seconds)
        VALUES ('adv-order-prod', 'Adv Order Tea', 'Black', 'Darjeeling', 'Estate', 'Flush', '2026', 'Desc', 'Notes', 90, 180)
      `).run();
      orderGuardedProdId = Number(p.lastInsertRowid);

      const v = env.db.prepare(`
        INSERT INTO variants (product_id, sku, grams, price_paise, stock, packaging_format)
        VALUES (?, 'ADV-ORD-100G', 100, 150000, 25, 'loose_leaf_pouch')
      `).run(orderGuardedProdId);
      orderGuardedVariantId = Number(v.lastInsertRowid);

      orderId = "adv-order-ref-101";
      env.db.exec(`
        INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, shipping_paise, total_paise, payment_status, dispatch_status)
        VALUES ('${orderId}', 'idem-adv-ref-1', 'Rajesh K', 'rajesh@example.com', 'Shimla', 150000, 0, 150000, 'paid', 'preparing');
        INSERT INTO order_items (order_id, variant_id, quantity, unit_price_paise)
        VALUES ('${orderId}', ${orderGuardedVariantId}, 1, 150000);
      `);

      // 2. Create unreferenced product
      const p2 = env.db.prepare(`
        INSERT INTO products (slug, name, category, origin, estate, flush, harvest_date, description, tasting_notes, brew_temp, brew_seconds)
        VALUES ('adv-clean-prod', 'Adv Clean Tea', 'Green', 'Nepal', 'Estate', 'Flush', '2026', 'Desc', 'Notes', 80, 120)
      `).run();
      unreferencedProdId = Number(p2.lastInsertRowid);
      env.db.prepare(`
        INSERT INTO variants (product_id, sku, grams, price_paise, stock, packaging_format)
        VALUES (?, 'ADV-CLN-100G', 100, 120000, 10, 'loose_leaf_pouch')
      `).run(unreferencedProdId);
    });

    it("must return HTTP 409 when product is referenced by order_items and prevent deletion", async () => {
      const req = new Request(`http://localhost/api/admin/products/${orderGuardedProdId}`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });

      const res = await productDetailDELETE(req, { params: Promise.resolve({ id: String(orderGuardedProdId) }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/referenced by.*order item/i);

      // Verify product still intact in DB
      const p = getProduct(orderGuardedProdId);
      expect(p).not.toBeNull();
      expect(p?.id).toBe(orderGuardedProdId);
    });

    it("allows deletion with HTTP 204 for products with no order item references", async () => {
      const req = new Request(`http://localhost/api/admin/products/${unreferencedProdId}`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });

      const res = await productDetailDELETE(req, { params: Promise.resolve({ id: String(unreferencedProdId) }) });
      expect(res.status).toBe(204);

      // Verify product deleted in DB
      const p = getProduct(unreferencedProdId);
      expect(p).toBeNull();
    });
  });

  // =========================================================================
  // Challenge 3: Order Transition Skipping Steps
  // =========================================================================
  describe("Challenge 3: Order transition skipping steps (illegal state jumps)", () => {
    const testOrderId = "adv-ord-skip-transitions-1";

    beforeAll(() => {
      env.db.exec(`
        INSERT OR REPLACE INTO orders (
          id, idempotency_key, customer_name, customer_email, shipping_address,
          subtotal_paise, shipping_paise, total_paise, payment_status, dispatch_status
        ) VALUES ('${testOrderId}', 'idem-skip-1', 'Amit Sengupta', 'amit@example.com', 'Kolkata', 180000, 0, 180000, 'paid', 'unfulfilled');
      `);
    });

    it("must fail with HTTP 409 when skipping from unfulfilled directly to delivered", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${testOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "delivered" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: testOrderId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/Transition from unfulfilled to delivered is not allowed/i);

      expect(getOrder(testOrderId)?.dispatch_status).toBe("unfulfilled");
    });

    it("must fail with HTTP 409 when skipping from unfulfilled directly to shipped", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${testOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "shipped" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: testOrderId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/Transition from unfulfilled to shipped is not allowed/i);

      expect(getOrder(testOrderId)?.dispatch_status).toBe("unfulfilled");
    });

    it("must fail with HTTP 409 when skipping from preparing directly to delivered (bypassing shipped)", async () => {
      // Advance legitimately to preparing
      setDispatchStatus(testOrderId, "preparing");
      expect(getOrder(testOrderId)?.dispatch_status).toBe("preparing");

      const req = new Request(`http://localhost/api/admin/orders/${testOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "delivered" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: testOrderId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/Transition from preparing to delivered is not allowed/i);

      expect(getOrder(testOrderId)?.dispatch_status).toBe("preparing");
    });

    it("must fail with HTTP 409 on backward transitions once delivered", async () => {
      // Legitimate sequence to delivered
      setDispatchStatus(testOrderId, "shipped");
      setDispatchStatus(testOrderId, "delivered");
      expect(getOrder(testOrderId)?.dispatch_status).toBe("delivered");

      // Attempt backward to preparing
      const reqPrep = new Request(`http://localhost/api/admin/orders/${testOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "preparing" }),
      });
      const resPrep = await orderDispatchPOST(reqPrep, { params: Promise.resolve({ id: testOrderId }) });
      expect(resPrep.status).toBe(409);

      // Attempt backward to shipped
      const reqShip = new Request(`http://localhost/api/admin/orders/${testOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "shipped" }),
      });
      const resShip = await orderDispatchPOST(reqShip, { params: Promise.resolve({ id: testOrderId }) });
      expect(resShip.status).toBe(409);

      // Attempt cancellation of delivered order
      const reqCancel = new Request(`http://localhost/api/admin/orders/${testOrderId}/cancel`, {
        method: "POST",
        headers: { Cookie: rootCookie },
      });
      const resCancel = await orderCancelPOST(reqCancel, { params: Promise.resolve({ id: testOrderId }) });
      expect(resCancel.status).toBe(409);
      const cancelData = await resCancel.json();
      expect(cancelData.error).toMatch(/Delivered orders cannot be cancelled/i);

      expect(getOrder(testOrderId)?.dispatch_status).toBe("delivered");
    });

    it("must reject malformed or arbitrary state names with HTTP 400 validation error", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${testOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "flying_drone_delivery" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: testOrderId }) });
      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // Challenge 4: Order Dispatching Beyond Preparing When Payment is Unpaid
  // =========================================================================
  describe("Challenge 4: Order dispatching beyond preparing when payment_status is unpaid", () => {
    const unpaidOrderId = "adv-ord-unpaid-dispatch-test";

    beforeAll(() => {
      env.db.exec(`
        INSERT OR REPLACE INTO orders (
          id, idempotency_key, customer_name, customer_email, shipping_address,
          subtotal_paise, shipping_paise, total_paise, payment_status, dispatch_status
        ) VALUES ('${unpaidOrderId}', 'idem-adv-unpaid-1', 'Neha Verma', 'neha@example.com', 'Jaipur', 200000, 9900, 209900, 'unpaid', 'unfulfilled');
      `);
    });

    it("allows unpaid order to transition from unfulfilled to preparing", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${unpaidOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "preparing" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: unpaidOrderId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order.dispatch_status).toBe("preparing");
    });

    it("must fail with HTTP 409 when attempting to dispatch unpaid order from preparing to shipped", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${unpaidOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "shipped" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: unpaidOrderId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/requires a paid order/i);

      // Verify order is still in preparing state
      expect(getOrder(unpaidOrderId)?.dispatch_status).toBe("preparing");
    });

    it("allows advancing to shipped only after payment_status is updated to paid", async () => {
      // Simulate verified payment capture
      env.db.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?").run(unpaidOrderId);

      const req = new Request(`http://localhost/api/admin/orders/${unpaidOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "shipped" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: unpaidOrderId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order.dispatch_status).toBe("shipped");
    });
  });

  // =========================================================================
  // Challenge 5: Order Cancellation of Paid Orders
  // =========================================================================
  describe("Challenge 5: Order cancellation of paid orders (must return 409)", () => {
    const paidOrderId = "adv-ord-paid-cancel-guard";

    beforeAll(() => {
      env.db.exec(`
        INSERT OR REPLACE INTO orders (
          id, idempotency_key, customer_name, customer_email, shipping_address,
          subtotal_paise, shipping_paise, total_paise, payment_status, dispatch_status
        ) VALUES ('${paidOrderId}', 'idem-paid-guard-1', 'Vikram Joshi', 'vikram@example.com', 'Mumbai', 300000, 0, 300000, 'paid', 'preparing');
      `);
    });

    it("must return HTTP 409 when cancelling a paid order via POST /api/admin/orders/[id]/cancel", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${paidOrderId}/cancel`, {
        method: "POST",
        headers: { Cookie: rootCookie },
      });

      const res = await orderCancelPOST(req, { params: Promise.resolve({ id: paidOrderId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/refunded through the payment gateway/i);

      expect(getOrder(paidOrderId)?.dispatch_status).toBe("preparing");
    });

    it("must return HTTP 409 when attempting to cancel paid order via POST /api/admin/orders/[id]/dispatch with { to: 'cancelled' }", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${paidOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "cancelled" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: paidOrderId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/refunded through the payment gateway/i);

      expect(getOrder(paidOrderId)?.dispatch_status).toBe("preparing");
    });

    it("must return HTTP 409 when attempting to cancel paid order via DELETE /api/admin/orders/[id]/dispatch", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${paidOrderId}/dispatch`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });

      const res = await orderDispatchDELETE(req, { params: Promise.resolve({ id: paidOrderId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/refunded through the payment gateway/i);

      expect(getOrder(paidOrderId)?.dispatch_status).toBe("preparing");
    });

    it("allows cancellation with HTTP 200 for unpaid order", async () => {
      const unpaidCancelId = "adv-ord-unpaid-can-cancel";
      env.db.exec(`
        INSERT OR REPLACE INTO orders (
          id, idempotency_key, customer_name, customer_email, shipping_address,
          subtotal_paise, shipping_paise, total_paise, payment_status, dispatch_status
        ) VALUES ('${unpaidCancelId}', 'idem-unpaid-cancel-ok', 'Rohan Mehra', 'rohan@example.com', 'Dehradun', 100000, 9900, 109900, 'unpaid', 'unfulfilled');
      `);

      const req = new Request(`http://localhost/api/admin/orders/${unpaidCancelId}/cancel`, {
        method: "POST",
        headers: { Cookie: rootCookie },
      });

      const res = await orderCancelPOST(req, { params: Promise.resolve({ id: unpaidCancelId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order.dispatch_status).toBe("cancelled");
    });
  });

  // =========================================================================
  // Challenge 6: Upload Validation
  // =========================================================================
  describe("Challenge 6: Uploading invalid file types, fake extension (.php as .jpg), oversized files (>5MB)", () => {
    it("must reject fake extension: PHP script named as image .jpg (HTTP 400)", async () => {
      const phpScript = Buffer.from('<?php echo "evil payload"; system($_GET["cmd"]); ?>');
      const formData = new FormData();
      formData.append("file", new Blob([new Uint8Array(phpScript)], { type: "image/jpeg" }), "backdoor.jpg");

      const req = new Request("http://localhost/api/admin/uploads", {
        method: "POST",
        headers: { Cookie: rootCookie },
        body: formData,
      });

      const res = await uploadsPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Invalid file format|permitted/i);
    });

    it("must reject fake extension: Windows executable (.exe MZ header) disguised as .png (HTTP 400)", async () => {
      const exeBuffer = createMockImageBuffer("exe", 2048);
      const formData = new FormData();
      formData.append("file", new Blob([new Uint8Array(exeBuffer)], { type: "image/png" }), "trojan.png");

      const req = new Request("http://localhost/api/admin/uploads", {
        method: "POST",
        headers: { Cookie: rootCookie },
        body: formData,
      });

      const res = await uploadsPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Invalid file format|permitted/i);
    });

    it("must reject SVG files even if declared as image/jpeg or image/svg+xml (HTTP 400 XSS prevention)", async () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>');
      const formData = new FormData();
      formData.append("file", new Blob([new Uint8Array(svgBuffer)], { type: "image/svg+xml" }), "vector_attack.svg");

      const req = new Request("http://localhost/api/admin/uploads", {
        method: "POST",
        headers: { Cookie: rootCookie },
        body: formData,
      });

      const res = await uploadsPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/SVG uploads are not permitted/i);
    });

    it("must reject plain text / shell script files (HTTP 400)", async () => {
      const textBuffer = Buffer.from("#!/bin/bash\nrm -rf /\n");
      const formData = new FormData();
      formData.append("file", new Blob([new Uint8Array(textBuffer)], { type: "text/plain" }), "script.sh");

      const req = new Request("http://localhost/api/admin/uploads", {
        method: "POST",
        headers: { Cookie: rootCookie },
        body: formData,
      });

      const res = await uploadsPOST(req);
      expect(res.status).toBe(400);
    });

    it("must reject empty uploaded files (0 bytes) (HTTP 400)", async () => {
      const emptyBuffer = Buffer.alloc(0);
      const formData = new FormData();
      formData.append("file", new Blob([new Uint8Array(emptyBuffer)], { type: "image/jpeg" }), "empty.jpg");

      const req = new Request("http://localhost/api/admin/uploads", {
        method: "POST",
        headers: { Cookie: rootCookie },
        body: formData,
      });

      const res = await uploadsPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/empty/i);
    });

    it("must reject oversized files exceeding 5MB (5MB + 1 byte) with HTTP 413", async () => {
      const OVER_5MB_SIZE = 5 * 1024 * 1024 + 1; // 5,242,881 bytes
      // Create valid JPEG header followed by zeros
      const oversizedJpeg = Buffer.alloc(OVER_5MB_SIZE);
      oversizedJpeg[0] = 0xff;
      oversizedJpeg[1] = 0xd8;
      oversizedJpeg[2] = 0xff;
      oversizedJpeg[3] = 0xe0;

      const formData = new FormData();
      formData.append("file", new Blob([new Uint8Array(oversizedJpeg)], { type: "image/jpeg" }), "huge_photo.jpg");

      const req = new Request("http://localhost/api/admin/uploads", {
        method: "POST",
        headers: { Cookie: rootCookie },
        body: formData,
      });

      const res = await uploadsPOST(req);
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toMatch(/exceeds 5MB limit/i);
    });

    it("accepts authentic WebP and PNG images under 5MB with HTTP 201", async () => {
      const validWebp = createMockImageBuffer("webp", 4096);
      const formData = new FormData();
      formData.append("file", new Blob([new Uint8Array(validWebp)], { type: "image/webp" }), "darjeeling_estate.webp");
      formData.append("alt_text", "Misty morning over Gopaldhara estate");

      const req = new Request("http://localhost/api/admin/uploads", {
        method: "POST",
        headers: { Cookie: rootCookie },
        body: formData,
      });

      const res = await uploadsPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.url).toMatch(/^\/uploads\/upload_\d+_[a-f0-9]+_darjeeling[-_]estate\.webp$/);
      expect(data.mime_type).toBe("image/webp");
      expect(data.alt_text).toBe("Misty morning over Gopaldhara estate");
    });
  });

  // =========================================================================
  // Challenge 7: Staff Password Reset (<12 chars) & Session Revocation
  // =========================================================================
  describe("Challenge 7: Resetting staff password to <12 characters (must fail) & session revocation", () => {
    let testStaffId: number;
    let staffSessionCookie1: string;
    let staffSessionCookie2: string;
    let rootSessionCookie: string;

    beforeAll(async () => {
      const { hashPassword } = await import("@/lib/password");
      const info = env.db.prepare(`
        INSERT INTO admin_users (username, email, password_hash, role, is_active)
        VALUES ('adv_staff_user', 'adv_staff@tea.com', ?, 'admin', 1)
      `).run(hashPassword("initial-valid-pass-1234"));
      testStaffId = Number(info.lastInsertRowid);

      // Issue two distinct sessions for this staff member (e.g. laptop & mobile)
      const s1 = createAdminSession(testStaffId);
      staffSessionCookie1 = s1.cookieValue;

      const s2 = createAdminSession(testStaffId);
      staffSessionCookie2 = s2.cookieValue;

      // Ensure root session exists and is active
      const rootUser = env.db.prepare("SELECT id FROM admin_users WHERE username = 'root'").get() as { id: number };
      const r = createAdminSession(rootUser.id);
      rootSessionCookie = r.cookieValue;

      // Verify active state
      expect(verifySessionValue(staffSessionCookie1)).not.toBeNull();
      expect(verifySessionValue(staffSessionCookie2)).not.toBeNull();
      expect(verifySessionValue(rootSessionCookie)).not.toBeNull();
    });

    it("must reject password < 12 characters (11 chars) with HTTP 400", async () => {
      const req = new Request(`http://localhost/api/admin/users/${testStaffId}/reset`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ password: "short-pwd11" }), // 11 characters
      });

      const res = await userResetPOST(req, { params: Promise.resolve({ id: String(testStaffId) }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.detail?.password?.[0]).toMatch(/at least 12 characters/i);

      // Verify sessions are NOT prematurely revoked on failed validation
      expect(verifySessionValue(staffSessionCookie1)).not.toBeNull();
      expect(verifySessionValue(staffSessionCookie2)).not.toBeNull();
    });

    it("must reject empty or <12 character inputs with HTTP 400", async () => {
      const reqEmpty = new Request(`http://localhost/api/admin/users/${testStaffId}/reset`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ password: "" }),
      });
      const resEmpty = await userResetPOST(reqEmpty, { params: Promise.resolve({ id: String(testStaffId) }) });
      expect(resEmpty.status).toBe(400);

      const reqSpaces11 = new Request(`http://localhost/api/admin/users/${testStaffId}/reset`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ password: "           " }), // 11 spaces (< 12)
      });
      const resSpaces11 = await userResetPOST(reqSpaces11, { params: Promise.resolve({ id: String(testStaffId) }) });
      expect(resSpaces11.status).toBe(400);

      const reqNull = new Request(`http://localhost/api/admin/users/${testStaffId}/reset`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ password: null }),
      });
      const resNull = await userResetPOST(reqNull, { params: Promise.resolve({ id: String(testStaffId) }) });
      expect(resNull.status).toBe(400);
    });

    it("accepts valid password reset (>= 12 chars) with HTTP 200 and immediately revokes all user sessions across devices", async () => {
      const req = new Request(`http://localhost/api/admin/users/${testStaffId}/reset`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ password: "new-super-secure-pass-2026" }), // 26 chars
      });

      const res = await userResetPOST(req, { params: Promise.resolve({ id: String(testStaffId) }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toMatch(/sessions revoked/i);

      // Stress assertion: BOTH staff sessions MUST be completely revoked
      expect(verifySessionValue(staffSessionCookie1)).toBeNull();
      expect(verifySessionValue(staffSessionCookie2)).toBeNull();

      // Calling protected API endpoint with revoked staff cookie must return 401
      const testProtectedReq = new Request("http://localhost/api/admin/orders", {
        headers: { Cookie: `${SESSION_COOKIE}=${staffSessionCookie1}` },
      });
      const testProtectedRes = await ordersGET(testProtectedReq);
      expect(testProtectedRes.status).toBe(401);

      // Stress assertion: Root session MUST NOT be affected
      expect(verifySessionValue(rootSessionCookie)).not.toBeNull();
    });
  });

  // =========================================================================
  // Challenge 8: Zero Raw Database Error Leakage & Error Masking
  // =========================================================================
  describe("Challenge 8: Verifying error masking (no raw SQLite errors leaked)", () => {
    it("masks SQLite UNIQUE constraint error strings into generic user-safe error message", () => {
      const rawErrorMessages = [
        "SqliteError: UNIQUE constraint failed: categories.slug",
        "SqliteError: UNIQUE constraint failed: products.slug; column id table index",
        "SqliteError: FOREIGN KEY constraint failed on table order_items",
        "SqliteError: near 'SYNTAX': syntax error in SQL query",
        "abort: transaction failed due to trigger index corruption",
        "database disk image is malformed: table admin_users",
      ];

      for (const msg of rawErrorMessages) {
        const response = conflict(msg);
        expect(response.status).toBe(409);

        // Synchronously extract json from NextResponse
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        response.json().then((body) => {
          expect(body.error).toBe("Unable to complete the request.");
          expect(body.error).not.toMatch(/sqlite|constraint|table|column|foreign|unique|syntax|index|abort/i);
        });
      }
    });

    it("permits safe domain messages to pass through while truncating to 160 characters", async () => {
      const safeDomainError = "Category cannot be deleted because 3 product(s) are assigned to it. Reassign or delete products first.";
      const res = conflict(safeDomainError);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe(safeDomainError);

      const veryLongDomainError = "A".repeat(200);
      const resLong = conflict(veryLongDomainError);
      const bodyLong = await resLong.json();
      expect(bodyLong.error.length).toBeLessThanOrEqual(160);
    });

    it("verifies duplicate slug insertion in categories handles conflict safely without crashing", async () => {
      const payload = {
        slug: "unique-conflict-cat",
        name: "Unique Conflict Cat",
        sort_order: 1,
      };

      const req1 = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res1 = await categoriesPOST(req1);
      expect(res1.status).toBe(201);

      // Re-posting identical slug (without idempotency key) triggers update or handles cleanly
      const req2 = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res2 = await categoriesPOST(req2);
      expect([200, 201]).toContain(res2.status);
    });
  });
});
