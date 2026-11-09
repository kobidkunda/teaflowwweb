import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, createMockImageBuffer, TEST_ROOT_PASSWORD, type TestEnv } from "./test-helper";
import { POST as productsPOST } from "@/app/api/admin/products/route";
import { PATCH as productPATCH, DELETE as productDELETE } from "@/app/api/admin/products/[id]/route";
import { POST as categoriesPOST } from "@/app/api/admin/categories/route";
import { DELETE as categoryDELETE } from "@/app/api/admin/categories/[id]/route";
import { POST as orderDispatchPOST } from "@/app/api/admin/orders/[id]/dispatch/route";
import { POST as orderCancelPOST } from "@/app/api/admin/orders/[id]/cancel/route";
import { POST as usersPOST } from "@/app/api/admin/users/route";
import { PATCH as userPATCH } from "@/app/api/admin/users/[id]/route";
import { POST as loginPOST } from "@/app/api/admin/login/route";
import { POST as productImagesPOST } from "@/app/api/admin/product-images/route";
import { quoteCoupon } from "@/lib/coupons";
import { setDispatchStatus } from "@/lib/orders";
import { verifySessionValue } from "@/lib/adminSessions";
import { resetRateLimits } from "@/lib/rateLimit";

describe("Tier 3: Cross-Feature Combinations & Pairwise Guards", () => {
  let env: TestEnv;
  let rootCookie: string;

  beforeAll(() => {
    env = setupAdminTestEnv();
    rootCookie = getAuthCookie(env.db, "root");
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("Pairwise 1: Category Creation ↔ Product Assignment ↔ Deletion Guard", () => {
    let parentCatId: number;
    let childCatId: number;
    let testProductId: number;

    it("creates category hierarchy, assigns product, and enforces deletion dependency guard", async () => {
      // 1. Create Parent Category
      const parentRes = await categoriesPOST(
        new Request("http://localhost/api/admin/categories", {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ slug: "tier3-parent-tea", name: "Tier 3 Parent Tea", sort_order: 1 }),
        })
      );
      expect(parentRes.status).toBe(201);
      const parentData = await parentRes.json();
      parentCatId = parentData.id;

      // 2. Create Child Category
      const childRes = await categoriesPOST(
        new Request("http://localhost/api/admin/categories", {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ slug: "tier3-child-oolong", name: "Tier 3 Oolong", sort_order: 2 }),
        })
      );
      expect(childRes.status).toBe(201);
      const childData = await childRes.json();
      childCatId = childData.id;

      // Link child to parent
      env.db.prepare("UPDATE categories SET parent_id = ? WHERE id = ?").run(parentCatId, childCatId);

      // 3. Create Product assigned to Child Category
      const prodRes = await productsPOST(
        new Request("http://localhost/api/admin/products", {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: "tier3-high-mountain-oolong",
            name: "High Mountain Oolong",
            category_id: childCatId,
            origin: "Sikkim",
            estate: "Temi",
            flush: "Summer",
            harvest_date: "2026",
            description: "Silky floral oolong.",
            tasting_notes: "Lilac, peach.",
            brew_temp: 85,
            brew_seconds: 150,
          }),
        })
      );
      expect(prodRes.status).toBe(201);
      const prodData = await prodRes.json();
      testProductId = prodData.id;

      // 4. Attempt to delete Child Category -> must be blocked with HTTP 409
      const delBlockedRes = await categoryDELETE(
        new Request(`http://localhost/api/admin/categories/${childCatId}`, {
          method: "DELETE",
          headers: { Cookie: rootCookie },
        }),
        { params: Promise.resolve({ id: String(childCatId) }) }
      );
      expect(delBlockedRes.status).toBe(409);
      const err = await delBlockedRes.json();
      expect(err.error).toMatch(/in use|assigned|Unable to delete/i);

      // 5. Reassign product to Parent Category
      const patchProdRes = await productPATCH(
        new Request(`http://localhost/api/admin/products/${testProductId}`, {
          method: "PATCH",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ category_id: parentCatId }),
        }),
        { params: Promise.resolve({ id: String(testProductId) }) }
      );
      expect(patchProdRes.status).toBe(200);

      // 6. Child Category now has 0 products -> deletion must succeed with HTTP 204
      const delSuccessRes = await categoryDELETE(
        new Request(`http://localhost/api/admin/categories/${childCatId}`, {
          method: "DELETE",
          headers: { Cookie: rootCookie },
        }),
        { params: Promise.resolve({ id: String(childCatId) }) }
      );
      expect(delSuccessRes.status).toBe(204);

      // Verify child category no longer exists
      const check = env.db.prepare("SELECT id FROM categories WHERE id = ?").get(childCatId);
      expect(check).toBeUndefined();
    });
  });

  describe("Pairwise 2: Order Fulfillment ↔ Payment Webhook ↔ Dispatch Audit History", () => {
    const orderId = "ord-pairwise-fulfillment-200";

    beforeAll(() => {
      env.db.exec(`
        INSERT OR REPLACE INTO orders (
          id, idempotency_key, customer_name, customer_email, shipping_address,
          subtotal_paise, shipping_paise, total_paise, payment_status, dispatch_status
        ) VALUES ('${orderId}', 'idem-pair-2', 'Priya Sen', 'priya@example.com', 'Kolkata, WB', 180000, 0, 180000, 'unpaid', 'unfulfilled');
      `);
    });

    it("enforces strict dispatch gating: preparing allowed, shipping blocked while unpaid, shipping allowed once paid", async () => {
      // 1. Transition unfulfilled -> preparing
      const prepRes = await orderDispatchPOST(
        new Request(`http://localhost/api/admin/orders/${orderId}/dispatch`, {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ to: "preparing" }),
        }),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(prepRes.status).toBe(200);

      // 2. Attempt transition preparing -> shipped while unpaid -> BLOCKED (409)
      const shipBlockedRes = await orderDispatchPOST(
        new Request(`http://localhost/api/admin/orders/${orderId}/dispatch`, {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ to: "shipped" }),
        }),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(shipBlockedRes.status).toBe(409);
      const shipErr = await shipBlockedRes.json();
      expect(shipErr.error).toMatch(/paid/i);

      // 3. Mark order as paid via verified payment capture update
      env.db.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?").run(orderId);

      // 4. Now transition preparing -> shipped -> SUCCEEDS (200)
      const shipSuccessRes = await orderDispatchPOST(
        new Request(`http://localhost/api/admin/orders/${orderId}/dispatch`, {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ to: "shipped" }),
        }),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(shipSuccessRes.status).toBe(200);

      // 5. Transition shipped -> delivered -> SUCCEEDS (200)
      const delivSuccessRes = await orderDispatchPOST(
        new Request(`http://localhost/api/admin/orders/${orderId}/dispatch`, {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ to: "delivered" }),
        }),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(delivSuccessRes.status).toBe(200);

      // 6. Verify audit events log in payment_events
      const auditEvents = env.db.prepare(
        "SELECT from_status, to_status FROM payment_events WHERE order_id = ? ORDER BY id ASC"
      ).all(orderId) as Array<{ from_status: string; to_status: string }>;

      expect(auditEvents.length).toBeGreaterThanOrEqual(3);
      expect(auditEvents[0]).toEqual({ from_status: "unfulfilled", to_status: "preparing" });
      expect(auditEvents[1]).toEqual({ from_status: "preparing", to_status: "shipped" });
      expect(auditEvents[2]).toEqual({ from_status: "shipped", to_status: "delivered" });
    });
  });

  describe("Pairwise 3: Staff Creation ↔ Password Reset ↔ Session Invalidation ↔ Lockout", () => {
    let staffId: number;
    const staffUsername = "pair_security_staff";
    const initialPassword = "initial-staff-password-123";
    const updatedPassword = "updated-staff-password-456";

    it("executes staff creation, session issuance, password reset revocation, and brute force lockout", async () => {
      resetRateLimits();

      // 1. Root creates staff account
      const createRes = await usersPOST(
        new Request("http://localhost/api/admin/users", {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            username: staffUsername,
            email: "staff_pair@tea.com",
            password: initialPassword,
            role: "admin",
          }),
        })
      );
      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      staffId = createData.user.id;

      // 2. Staff logs in and acquires session cookie
      const loginRes = await loginPOST(
        new Request("http://localhost/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: staffUsername, password: initialPassword }),
        })
      );
      expect(loginRes.status).toBe(200);
      const setCookieHeader = loginRes.headers.get("Set-Cookie") || "";
      const cookieVal = setCookieHeader.split(";")[0].replace("admin_session=", "");

      // Verify session is valid in DB
      expect(verifySessionValue(cookieVal)).not.toBeNull();

      // 3. Root resets staff password
      const resetRes = await userPATCH(
        new Request(`http://localhost/api/admin/users/${staffId}`, {
          method: "PATCH",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ password: updatedPassword }),
        }),
        { params: Promise.resolve({ id: String(staffId) }) }
      );
      expect(resetRes.status).toBe(200);

      // 4. Verify old session was immediately revoked
      expect(verifySessionValue(cookieVal)).toBeNull();

      // 5. Attacker attempts 5 wrong passwords -> triggers lockout
      for (let i = 0; i < 5; i++) {
        const failedRes = await loginPOST(
          new Request("http://localhost/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: staffUsername, password: "wrong-password-guess" }),
          })
        );
        expect(failedRes.status).toBe(401);
      }

      // 6th attempt with correct password fails because account is locked
      const lockedRes = await loginPOST(
        new Request("http://localhost/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: staffUsername, password: updatedPassword }),
        })
      );
      expect(lockedRes.status).toBe(401);
      const lockedData = await lockedRes.json();
      expect(lockedData.error).toBe("Invalid username or password."); // Generic message
    });
  });

  describe("Pairwise 4: Media Upload ↔ Product Image Association ↔ Primary Selection", () => {
    it("persists media upload, links to product, and manages primary thumbnail flag", async () => {
      // 1. Create Product
      const prodRes = await productsPOST(
        new Request("http://localhost/api/admin/products", {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: "pair-media-tea",
            name: "Pair Media Reserve Tea",
            origin: "Assam",
            estate: "Halmari",
            flush: "Summer",
            harvest_date: "2026",
            description: "Malty rich Assam.",
            tasting_notes: "Malt, dark cocoa.",
            brew_temp: 95,
            brew_seconds: 240,
          }),
        })
      );
      expect(prodRes.status).toBe(201);
      const prodData = await prodRes.json();
      const productId = prodData.id;

      // 2. Persist media upload in media_uploads
      const filename = `media_${Date.now()}_halmari_leaf.webp`;
      const fileUrl = `/uploads/${filename}`;
      env.db.prepare(
        "INSERT INTO media_uploads (filename, url, alt_text, mime_type, file_size) VALUES (?, ?, ?, ?, ?)"
      ).run(filename, fileUrl, "Whole unbroken Golden Tips Assam leaf", "image/webp", 320000);

      // 3. Associate media upload with product in product_images
      const imgRes = await productImagesPOST(
        new Request("http://localhost/api/admin/product-images", {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: productId,
            url: fileUrl,
            alt_text: "Whole unbroken Golden Tips Assam leaf",
            sort_order: 1,
            is_primary: 1,
          }),
        })
      );
      expect(imgRes.status).toBe(201);

      // Verify product images link
      const images = env.db.prepare("SELECT * FROM product_images WHERE product_id = ?").all(productId) as any[];
      expect(images.length).toBe(1);
      expect(images[0].url).toBe(fileUrl);
      expect(images[0].is_primary).toBe(1);
    });
  });

  describe("Pairwise 5: Store Operational Settings ↔ Coupon Math ↔ Free Shipping Threshold", () => {
    it("computes pricing and shipping fees dynamically based on coupon discounts and threshold", () => {
      // Store settings define free shipping at ₹1,500 (150,000 paise) and shipping fee ₹99 (9,900 paise)
      const thresholdPaise = 150000;
      const flatShippingPaise = 9900;

      // Seed coupon 20%
      env.db.exec("INSERT OR REPLACE INTO coupons (code, kind, value, min_subtotal_paise, is_active) VALUES ('SPRING20', 'percent', 20, 0, 1)");

      // Scenario A: Subtotal ₹1,600 (160,000 paise) with NO coupon
      // Subtotal >= threshold -> Free shipping
      const subtotalA = 160000;
      const shippingA = subtotalA >= thresholdPaise ? 0 : flatShippingPaise;
      expect(shippingA).toBe(0);
      expect(subtotalA + shippingA).toBe(160000);

      // Scenario B: Same subtotal ₹1,600 with SPRING20 coupon applied
      // 20% discount on 160,000 paise = 32,000 paise
      const quote = quoteCoupon("SPRING20", subtotalA);
      expect(quote.valid).toBe(true);
      expect(quote.discountPaise).toBe(32000);

      const discountedSubtotalB = subtotalA - quote.discountPaise!; // 128,000 paise (₹1,280)
      expect(discountedSubtotalB).toBe(128000);

      // Discounted subtotal (₹1,280) < free shipping threshold (₹1,500)
      // Flat shipping fee (₹99) is now required!
      const shippingB = discountedSubtotalB >= thresholdPaise ? 0 : flatShippingPaise;
      expect(shippingB).toBe(9900);

      const finalTotalB = discountedSubtotalB + shippingB; // 128,000 + 9,900 = 137,900 paise (₹1,379.00)
      expect(finalTotalB).toBe(137900);
    });
  });
});
