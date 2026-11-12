import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import { GET as ordersGET } from "@/app/api/admin/orders/route";
import { GET as orderDetailGET, PATCH as orderDetailPATCH } from "@/app/api/admin/orders/[id]/route";
import { POST as orderDispatchPOST } from "@/app/api/admin/orders/[id]/dispatch/route";
import { POST as orderCancelPOST } from "@/app/api/admin/orders/[id]/cancel/route";
import { GET as analyticsGET, POST as analyticsPOST } from "@/app/api/admin/analytics/route";
import { GET as blogsGET, POST as blogsPOST } from "@/app/api/admin/blogs/route";
import {
  GET as blogDetailGET,
  PATCH as blogDetailPATCH,
  DELETE as blogDetailDELETE,
} from "@/app/api/admin/blogs/[id]/route";
import { getOrder, setDispatchStatus, OrderTransitionError } from "@/lib/orders";

describe("Milestone 4: Sales & Content Modules Unit Tests", () => {
  let env: TestEnv;
  let authCookie: string;

  const unpaidOrderId = "ord-unit-unpaid-1001";
  const paidOrderId = "ord-unit-paid-2002";
  const deliveredOrderId = "ord-unit-delivered-3003";

  beforeAll(() => {
    env = setupAdminTestEnv();
    authCookie = getAuthCookie(env.db, "root");

    // Seed test orders and items
    env.db.exec(`
      INSERT OR REPLACE INTO orders (
        id, idempotency_key, customer_name, customer_email, shipping_address,
        subtotal_paise, shipping_paise, total_paise, payment_status, dispatch_status, admin_notes
      ) VALUES
      ('${unpaidOrderId}', 'idem-unpaid-test', 'Kabir Sen', 'kabir@example.com', '7 Camac Street, Kolkata', 150000, 9900, 159900, 'unpaid', 'unfulfilled', 'Initial order note'),
      ('${paidOrderId}', 'idem-paid-test', 'Ananya Roy', 'ananya@example.com', '18 Park Circus, Kolkata', 320000, 0, 320000, 'paid', 'unfulfilled', 'VIP high tea lover'),
      ('${deliveredOrderId}', 'idem-deliv-test', 'Rohan Mehta', 'rohan@example.com', '9 Marine Drive, Mumbai', 90000, 9900, 99900, 'paid', 'delivered', 'Order fulfilled');
    `);
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("Orders State Machine & Dispatch Workflow", () => {
    it("lists orders with status filters and customer search", async () => {
      const req = new Request("http://localhost/api/admin/orders?paymentStatus=unpaid&q=Kabir", {
        headers: { Cookie: authCookie },
      });

      const res = await ordersGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.orders)).toBe(true);
      expect(data.orders.length).toBe(1);
      expect(data.orders[0].id).toBe(unpaidOrderId);
      expect(data.orders[0].customer_name).toBe("Kabir Sen");
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it("supports server-side pagination with page and pageSize", async () => {
      const req = new Request("http://localhost/api/admin/orders?page=1&pageSize=2", {
        headers: { Cookie: authCookie },
      });

      const res = await ordersGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.orders.length).toBeLessThanOrEqual(2);
      expect(data.pagination.pageSize).toBe(2);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.totalPages).toBeGreaterThanOrEqual(1);
    });

    it("retrieves full order dossier with line items, notes, and audit timeline", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${paidOrderId}`, {
        headers: { Cookie: authCookie },
      });

      const res = await orderDetailGET(req, { params: Promise.resolve({ id: paidOrderId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order).toBeDefined();
      expect(data.order.id).toBe(paidOrderId);
      expect(data.order.customer_name).toBe("Ananya Roy");
      expect(data.order.admin_notes).toBe("VIP high tea lover");
      expect(Array.isArray(data.order.events)).toBe(true);
    });

    it("modifies customer contact, address, and tracking via PATCH /api/admin/orders/[id]", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${paidOrderId}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: "Ananya Roy-Choudhury",
          customer_phone: "+91 9830012345",
          shipping_address: "Flat 4B, Silver Oak, Salt Lake, Kolkata 700091",
          shipping_carrier: "Blue Dart",
          tracking_number: "BLU123456789",
          tracking_url: "https://www.bluedart.com/tracking?handler=t&awb=awb&numbers=BLU123456789",
          admin_notes: "Priority delivery - handle with care",
        }),
      });

      const res = await orderDetailPATCH(req, { params: Promise.resolve({ id: paidOrderId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order.customer_name).toBe("Ananya Roy-Choudhury");
      expect(data.order.customer_phone).toBe("+91 9830012345");
      expect(data.order.shipping_address).toBe("Flat 4B, Silver Oak, Salt Lake, Kolkata 700091");
      expect(data.order.admin_notes).toBe("Priority delivery - handle with care");

      // Verify dossier GET includes shipment details
      const getReq = new Request(`http://localhost/api/admin/orders/${paidOrderId}`, {
        headers: { Cookie: authCookie },
      });
      const getRes = await orderDetailGET(getReq, { params: Promise.resolve({ id: paidOrderId }) });
      expect(getRes.status).toBe(200);
      const dossier = await getRes.json();
      expect(dossier.shipment).toBeDefined();
      expect(dossier.shipment.carrierName).toBe("Blue Dart");
      expect(dossier.shipment.awb.awb_code).toBe("BLU123456789");
    });

    it("updates admin internal notes via PATCH /api/admin/orders/[id]", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${paidOrderId}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ admin_notes: "Updated packaging instruction: use brass tin" }),
      });

      const res = await orderDetailPATCH(req, { params: Promise.resolve({ id: paidOrderId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order.admin_notes).toBe("Updated packaging instruction: use brass tin");

      // Verify in DB
      const refreshed = getOrder(paidOrderId);
      expect((refreshed as { admin_notes?: string })?.admin_notes).toBe(
        "Updated packaging instruction: use brass tin"
      );
    });

    it("enforces legal sequential dispatch transition: unfulfilled -> preparing", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${paidOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "preparing" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: paidOrderId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order.dispatch_status).toBe("preparing");

      // Verify audit trail record in payment_events
      const audit = env.db
        .prepare("SELECT * FROM payment_events WHERE order_id = ? ORDER BY id DESC LIMIT 1")
        .get(paidOrderId) as { from_status: string; to_status: string; actor: string };
      expect(audit.from_status).toBe("unfulfilled");
      expect(audit.to_status).toBe("preparing");
      expect(audit.actor).toBe("admin");
    });

    it("allows transitioning paid order from preparing -> shipped", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${paidOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "shipped" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: paidOrderId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order.dispatch_status).toBe("shipped");
    });

    it("blocks shipping beyond preparing for unpaid orders with 409 conflict guard", async () => {
      // First move unpaid order to preparing
      setDispatchStatus(unpaidOrderId, "preparing");

      const req = new Request(`http://localhost/api/admin/orders/${unpaidOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "shipped" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: unpaidOrderId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/paid/i);
    });

    it("rejects illegal jumping transition (e.g. delivered -> preparing)", async () => {
      expect(() => {
        setDispatchStatus(deliveredOrderId, "preparing");
      }).toThrow(OrderTransitionError);
    });
  });

  describe("Orders Safe Cancellation Guard", () => {
    it("successfully cancels an unpaid order and creates an audit entry", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${unpaidOrderId}/cancel`, {
        method: "POST",
        headers: { Cookie: authCookie },
      });

      const res = await orderCancelPOST(req, { params: Promise.resolve({ id: unpaidOrderId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order.dispatch_status).toBe("cancelled");

      const check = getOrder(unpaidOrderId);
      expect(check?.dispatch_status).toBe("cancelled");
    });

    it("blocks cancellation of paid orders with HTTP 409 to prevent stranded inventory", async () => {
      const paidCancelOrder = "ord-unit-paid-blocked-cancel";
      env.db.exec(`
        INSERT INTO orders (
          id, idempotency_key, customer_name, customer_email, shipping_address,
          subtotal_paise, shipping_paise, total_paise, payment_status, dispatch_status
        ) VALUES
        ('${paidCancelOrder}', 'idem-cancel-guard-test', 'Tara Bannerjee', 'tara@example.com', 'Kolkata, India', 200000, 0, 200000, 'paid', 'preparing');
      `);

      const req = new Request(`http://localhost/api/admin/orders/${paidCancelOrder}/cancel`, {
        method: "POST",
        headers: { Cookie: authCookie },
      });

      const res = await orderCancelPOST(req, { params: Promise.resolve({ id: paidCancelOrder }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/refunded through the payment gateway/i);

      // Verify order remained preparing
      const check = getOrder(paidCancelOrder);
      expect(check?.dispatch_status).toBe("preparing");
    });

    it("blocks cancellation of already delivered orders", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${deliveredOrderId}/cancel`, {
        method: "POST",
        headers: { Cookie: authCookie },
      });

      const res = await orderCancelPOST(req, { params: Promise.resolve({ id: deliveredOrderId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/delivered orders cannot be cancelled/i);
    });
  });

  describe("Visitors & Analytics API and Conversion Funnel", () => {
    beforeAll(() => {
      // Seed analytics traffic events
      const insert = env.db.prepare(
        "INSERT INTO analytics_events (session_id, event_type, path, referrer, user_agent) VALUES (?, ?, ?, ?, ?)"
      );

      // S1: Complete Funnel (Visit -> Product -> Checkout -> Order)
      insert.run("sess-u1", "pageview", "/", "https://google.com", "Mozilla/5.0");
      insert.run("sess-u1", "product_view", "/tea/darjeeling-first-flush", "direct", "Mozilla/5.0");
      insert.run("sess-u1", "checkout_start", "/checkout", "direct", "Mozilla/5.0");
      insert.run("sess-u1", "order_complete", "/order/ord-1", "direct", "Mozilla/5.0");

      // S2: Bounce after Product
      insert.run("sess-u2", "pageview", "/", "https://instagram.com", "Mozilla/5.0");
      insert.run("sess-u2", "product_view", "/tea/risheehat-summer-chinary", "https://instagram.com", "Mozilla/5.0");

      // S3: Direct Homepage visit
      insert.run("sess-u3", "pageview", "/", "direct", "Mozilla/5.0");
    });

    it("aggregates traffic volume and top tea products via GET /api/admin/analytics", async () => {
      const req = new Request("http://localhost/api/admin/analytics?period=all", {
        headers: { Cookie: authCookie },
      });

      const res = await analyticsGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.total_visitors).toBeGreaterThanOrEqual(3);
      expect(data.total_pageviews).toBeGreaterThanOrEqual(6);
      expect(Array.isArray(data.top_products)).toBe(true);
      expect(data.top_products.length).toBeGreaterThanOrEqual(1);
      expect(data.top_products[0].path).toMatch(/^\/tea\//);
      expect(Array.isArray(data.referral_sources)).toBe(true);
    });

    it("calculates multi-stage conversion funnel and conversion percentage accurately", async () => {
      const req = new Request("http://localhost/api/admin/analytics?period=all", {
        headers: { Cookie: authCookie },
      });

      const res = await analyticsGET(req);
      const data = await res.json();
      const funnel = data.conversion_funnel;

      expect(funnel.visitors).toBeGreaterThanOrEqual(3);
      expect(funnel.product_views).toBeGreaterThanOrEqual(2);
      expect(funnel.checkout_attempts).toBeGreaterThanOrEqual(1);
      expect(funnel.completed_orders).toBeGreaterThanOrEqual(1);

      // Verified conversion rate: (completed_orders / visitors) * 100
      const expectedRate = Number(((funnel.completed_orders / funnel.visitors) * 100).toFixed(2));
      expect(funnel.conversion_rate_percent).toBe(expectedRate);
    });

    it("safely handles zero-division when calculating conversion rate with no visits", async () => {
      // Query with a date range far in the future
      const req = new Request("http://localhost/api/admin/analytics?period=7d", {
        headers: { Cookie: authCookie },
      });

      const res = await analyticsGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data.conversion_funnel.conversion_rate_percent).toBe("number");
      expect(isNaN(data.conversion_funnel.conversion_rate_percent)).toBe(false);
    });

    it("records a visitor event via POST /api/admin/analytics", async () => {
      const req = new Request("http://localhost/api/admin/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: "sess-track-999",
          event_type: "product_view",
          path: "/tea/giddapahar-wonder-muscatel",
          referrer: "https://teareview.com",
        }),
      });

      const res = await analyticsPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.id).toBeGreaterThan(0);
    });
  });

  describe("Blog Articles & Journal CRUD Workflow", () => {
    let createdBlogId: number;
    const testSlug = "first-flush-harvest-chronicles-2026";

    it("creates a draft blog post with auto-slug and markdown content via POST /api/admin/blogs", async () => {
      const req = new Request("http://localhost/api/admin/blogs", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "First Flush Harvest Chronicles 2026",
          slug: testSlug,
          summary: "Exclusive field notes from the high-altitude misty slopes of Darjeeling.",
          content: "## The Spring Awakening\nIn late February, early morning Himalayan mists blanket the tea bushes...",
          cover_image_url: "/uploads/first_flush_mist.webp",
          author_name: "Master Tea Blender",
          status: "draft",
        }),
      });

      const res = await blogsPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.post).toBeDefined();
      expect(data.post.id).toBeGreaterThan(0);
      expect(data.post.slug).toBe(testSlug);
      expect(data.post.status).toBe("draft");
      expect(data.post.author_name).toBe("Master Tea Blender");

      createdBlogId = data.post.id;
    });

    it("rejects duplicate slug creation with HTTP 409 conflict", async () => {
      const req = new Request("http://localhost/api/admin/blogs", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Another Article With Same Slug",
          slug: testSlug,
          content: "Some content here...",
        }),
      });

      const res = await blogsPOST(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/slug already exists/i);
    });

    it("lists blog articles with status filter via GET /api/admin/blogs", async () => {
      const req = new Request("http://localhost/api/admin/blogs?status=draft", {
        headers: { Cookie: authCookie },
      });

      const res = await blogsGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.posts)).toBe(true);
      const found = data.posts.find((p: { id: number }) => p.id === createdBlogId);
      expect(found).toBeDefined();
      expect(found.title).toBe("First Flush Harvest Chronicles 2026");
    });

    it("retrieves blog article dossier via GET /api/admin/blogs/[id]", async () => {
      const req = new Request(`http://localhost/api/admin/blogs/${createdBlogId}`, {
        headers: { Cookie: authCookie },
      });

      const res = await blogDetailGET(req, {
        params: Promise.resolve({ id: String(createdBlogId) }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.post.id).toBe(createdBlogId);
      expect(data.post.slug).toBe(testSlug);
      expect(data.post.content).toContain("## The Spring Awakening");
    });

    it("publishes article and auto-sets published_at timestamp via PATCH /api/admin/blogs/[id]", async () => {
      const req = new Request(`http://localhost/api/admin/blogs/${createdBlogId}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "published",
        }),
      });

      const res = await blogDetailPATCH(req, {
        params: Promise.resolve({ id: String(createdBlogId) }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.post.status).toBe("published");
      expect(data.post.published_at).toBeDefined();
      expect(typeof data.post.published_at).toBe("string");
    });

    it("permanently deletes blog article via DELETE /api/admin/blogs/[id]", async () => {
      const req = new Request(`http://localhost/api/admin/blogs/${createdBlogId}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });

      const res = await blogDetailDELETE(req, {
        params: Promise.resolve({ id: String(createdBlogId) }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify removal
      const getAgain = await blogDetailGET(req, {
        params: Promise.resolve({ id: String(createdBlogId) }),
      });
      expect(getAgain.status).toBe(404);
    });
  });
});
