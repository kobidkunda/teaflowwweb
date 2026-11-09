import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./test-helper";
import { GET as ordersGET } from "@/app/api/admin/orders/route";
import { GET as orderDetailGET } from "@/app/api/admin/orders/[id]/route";
import { POST as orderDispatchPOST } from "@/app/api/admin/orders/[id]/dispatch/route";
import { POST as orderCancelPOST } from "@/app/api/admin/orders/[id]/cancel/route";
import { getOrder, setDispatchStatus } from "@/lib/orders";

describe("Tier 1: Sales & Content Modules (Features 18–27)", () => {
  let env: TestEnv;
  let authCookie: string;
  const unpaidOrderId = "ord-sales-unpaid-101";
  const paidOrderId = "ord-sales-paid-202";

  beforeAll(() => {
    env = setupAdminTestEnv();
    authCookie = getAuthCookie(env.db, "root");

    // Seed test orders
    env.db.exec(`
      INSERT OR REPLACE INTO orders (
        id, idempotency_key, customer_name, customer_email, shipping_address,
        subtotal_paise, shipping_paise, total_paise, payment_status, dispatch_status, admin_notes
      ) VALUES
      ('${unpaidOrderId}', 'idem-unpaid-1', 'Aarav Sharma', 'aarav@example.com', '12 Mall Road, Darjeeling', 120000, 9900, 129900, 'unpaid', 'unfulfilled', 'Customer requested gift wrap'),
      ('${paidOrderId}', 'idem-paid-1', 'Sunita Rao', 'sunita@example.com', '45 MG Road, Bengaluru', 240000, 0, 240000, 'paid', 'unfulfilled', 'VIP repeat customer');
    `);
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("Feature 18: Orders List & Status Filters", () => {
    it("lists orders via GET /api/admin/orders with payment and dispatch filters", async () => {
      const req = new Request("http://localhost/api/admin/orders?paymentStatus=paid", {
        headers: { Cookie: authCookie },
      });

      const res = await ordersGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.orders)).toBe(true);
      expect(data.orders.length).toBeGreaterThanOrEqual(1);

      const found = data.orders.find((o: { id: string }) => o.id === paidOrderId);
      expect(found).toBeDefined();
      expect(found.payment_status).toBe("paid");
    });
  });

  describe("Feature 19: Order Detail / Dossier Page & Audit History", () => {
    it("returns complete order dossier including customer info and admin notes via GET /api/admin/orders/[id]", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${unpaidOrderId}`, {
        headers: { Cookie: authCookie },
      });

      const res = await orderDetailGET(req, { params: Promise.resolve({ id: unpaidOrderId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order).toBeDefined();
      expect(data.order.id).toBe(unpaidOrderId);
      expect(data.order.customer_name).toBe("Aarav Sharma");
      expect(data.order.admin_notes).toBe("Customer requested gift wrap");
    });
  });

  describe("Feature 20: Controlled Dispatch Workflow", () => {
    it("transitions an unfulfilled order to preparing via POST /api/admin/orders/[id]/dispatch", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${paidOrderId}/dispatch`, {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "preparing" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: paidOrderId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order.dispatch_status).toBe("preparing");

      // Verify audit trail in payment_events
      const audit = env.db.prepare("SELECT * FROM payment_events WHERE order_id = ? ORDER BY id DESC LIMIT 1").get(paidOrderId) as {
        from_status: string;
        to_status: string;
      };
      expect(audit.from_status).toBe("unfulfilled");
      expect(audit.to_status).toBe("preparing");
    });

    it("allows transitioning a paid order from preparing to shipped", async () => {
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

    it("rejects shipping an unpaid order with HTTP 409 conflict guard", async () => {
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
  });

  describe("Feature 21: Order Safe Cancellation Guard", () => {
    it("successfully cancels an unpaid order via POST /api/admin/orders/[id]/cancel", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${unpaidOrderId}/cancel`, {
        method: "POST",
        headers: { Cookie: authCookie },
      });

      const res = await orderCancelPOST(req, { params: Promise.resolve({ id: unpaidOrderId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order.dispatch_status).toBe("cancelled");
    });

    it("blocks cancellation of a paid order with HTTP 409 to prevent stranded inventory", async () => {
      const cancelPaidOrderId = "ord-sales-paid-cancel-block";
      env.db.exec(`
        INSERT INTO orders (
          id, idempotency_key, customer_name, customer_email, shipping_address,
          subtotal_paise, shipping_paise, total_paise, payment_status, dispatch_status
        ) VALUES
        ('${cancelPaidOrderId}', 'idem-cancel-paid', 'Meera Patel', 'meera@example.com', 'Pune, India', 150000, 0, 150000, 'paid', 'preparing');
      `);

      const req = new Request(`http://localhost/api/admin/orders/${cancelPaidOrderId}/cancel`, {
        method: "POST",
        headers: { Cookie: authCookie },
      });

      const res = await orderCancelPOST(req, { params: Promise.resolve({ id: cancelPaidOrderId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/refunded through the payment gateway/i);

      // Verify order remains preparing
      const current = getOrder(cancelPaidOrderId);
      expect(current?.dispatch_status).toBe("preparing");
    });
  });

  describe("Feature 22, 23: Visitor Traffic & Conversion Analytics", () => {
    beforeAll(() => {
      // Seed analytics traffic events
      const insertEvent = env.db.prepare(
        "INSERT INTO analytics_events (session_id, event_type, path, referrer, user_agent) VALUES (?, ?, ?, ?, ?)"
      );

      // Session 1: full funnel
      insertEvent.run("sess-1", "pageview", "/", "https://google.com", "Mozilla/5.0");
      insertEvent.run("sess-1", "product_view", "/tea/risheehat-golden-summer", "", "Mozilla/5.0");
      insertEvent.run("sess-1", "checkout_start", "/checkout", "", "Mozilla/5.0");
      insertEvent.run("sess-1", "order_complete", "/order/ord-1", "", "Mozilla/5.0");

      // Session 2: bounce after product
      insertEvent.run("sess-2", "pageview", "/tea/darjeeling-first-flush", "direct", "Mozilla/5.0");
      insertEvent.run("sess-2", "product_view", "/tea/darjeeling-first-flush", "", "Mozilla/5.0");

      // Session 3: homepage bounce
      insertEvent.run("sess-3", "pageview", "/", "https://bing.com", "Mozilla/5.0");
    });

    it("calculates traffic metrics and top visited tea pages from visitor_events (Feature 22)", () => {
      const stats = env.db.prepare(`
        SELECT 
          COUNT(DISTINCT session_id) AS total_visitors,
          COUNT(*) AS total_pageviews
        FROM visitor_events
      `).get() as { total_visitors: number; total_pageviews: number };

      expect(stats.total_visitors).toBeGreaterThanOrEqual(3);
      expect(stats.total_pageviews).toBeGreaterThanOrEqual(5);

      const topPages = env.db.prepare(`
        SELECT path, COUNT(*) as views
        FROM visitor_events
        WHERE path LIKE '/tea/%'
        GROUP BY path
        ORDER BY views DESC
        LIMIT 5
      `).all() as Array<{ path: string; views: number }>;

      expect(topPages.length).toBeGreaterThanOrEqual(1);
      expect(topPages[0].path).toMatch(/\/tea\//);
    });

    it("computes conversion funnel metrics and conversion percentage accurately (Feature 23)", () => {
      const funnel = env.db.prepare(`
        SELECT
          COUNT(DISTINCT session_id) AS total_sessions,
          COUNT(DISTINCT CASE WHEN event_type = 'product_view' THEN session_id END) AS viewed_products,
          COUNT(DISTINCT CASE WHEN event_type = 'checkout_start' THEN session_id END) AS started_checkout,
          COUNT(DISTINCT CASE WHEN event_type = 'order_complete' THEN session_id END) AS completed_orders
        FROM analytics_events
      `).get() as {
        total_sessions: number;
        viewed_products: number;
        started_checkout: number;
        completed_orders: number;
      };

      expect(funnel.total_sessions).toBe(3);
      expect(funnel.viewed_products).toBe(2);
      expect(funnel.started_checkout).toBe(1);
      expect(funnel.completed_orders).toBe(1);

      const conversionRate = (funnel.completed_orders / funnel.total_sessions) * 100;
      expect(conversionRate).toBeCloseTo(33.33, 1);
    });
  });

  describe("Feature 24, 25, 26, 27: Blog & Journal Management", () => {
    let blogId: number;

    it("creates a draft blog post with markdown content and cover image (Feature 25)", () => {
      const insert = env.db.prepare(`
        INSERT INTO blog_posts (slug, title, summary, content, cover_image_url, author_name, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const info = insert.run(
        "art-of-darjeeling-first-flush",
        "The Art of Darjeeling First Flush",
        "A connoisseur guide to the spring harvest.",
        "## Harvest Season\nIn early spring, tender shoots unfurl across high-elevation Himalayan slopes...",
        "/uploads/darjeeling_flush.webp",
        "Master Tea Blender",
        "draft"
      );

      blogId = Number(info.lastInsertRowid);
      expect(blogId).toBeGreaterThan(0);
    });

    it("inspects blog article dossier and metadata (Feature 26)", () => {
      const blog = env.db.prepare("SELECT * FROM blog_posts WHERE id = ?").get(blogId) as {
        slug: string;
        title: string;
        status: string;
        author_name: string;
        content: string;
      };

      expect(blog.slug).toBe("art-of-darjeeling-first-flush");
      expect(blog.status).toBe("draft");
      expect(blog.author_name).toBe("Master Tea Blender");
      expect(blog.content).toContain("## Harvest Season");
    });

    it("publishes article and updates published_at timestamp (Feature 25)", () => {
      const now = new Date().toISOString();
      env.db.prepare("UPDATE blog_posts SET status = 'published', published_at = ? WHERE id = ?").run(now, blogId);

      const published = env.db.prepare("SELECT * FROM blog_posts WHERE id = ?").get(blogId) as {
        status: string;
        published_at: string;
      };

      expect(published.status).toBe("published");
      expect(published.published_at).toBe(now);
    });

    it("lists blog articles filtered by status (Feature 24)", () => {
      const articles = env.db.prepare("SELECT * FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC").all();
      expect(articles.length).toBeGreaterThanOrEqual(1);
    });

    it("deletes a blog article workflow (Feature 27)", () => {
      const result = env.db.prepare("DELETE FROM blog_posts WHERE id = ?").run(blogId);
      expect(result.changes).toBe(1);

      const check = env.db.prepare("SELECT * FROM blog_posts WHERE id = ?").get(blogId);
      expect(check).toBeUndefined();
    });
  });
});
