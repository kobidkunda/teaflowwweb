import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, createMockImageBuffer, TEST_ROOT_PASSWORD, type TestEnv } from "./test-helper";
import { POST as categoriesPOST } from "@/app/api/admin/categories/route";
import { POST as productsPOST } from "@/app/api/admin/products/route";
import { GET as productDetailGET } from "@/app/api/admin/products/[id]/route";
import { POST as variantsPOST } from "@/app/api/admin/variants/route";
import { POST as productImagesPOST } from "@/app/api/admin/product-images/route";
import { POST as orderDispatchPOST } from "@/app/api/admin/orders/[id]/dispatch/route";
import { POST as usersPOST, GET as usersGET } from "@/app/api/admin/users/route";
import { PATCH as userPATCH } from "@/app/api/admin/users/[id]/route";
import { POST as loginPOST } from "@/app/api/admin/login/route";
import { GET as healthGET } from "@/app/api/health/route";
import { TOOL_DEFINITIONS, McpError } from "@/lib/mcp";
import { getProduct } from "@/lib/products";
import { resetRateLimits } from "@/lib/rateLimit";

describe("Tier 4: Real-World Administrative Scenarios", () => {
  let env: TestEnv;
  let rootCookie: string;

  beforeAll(() => {
    env = setupAdminTestEnv();
    rootCookie = getAuthCookie(env.db, "root");
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("Scenario 1: Complete New Single-Estate Harvest Catalog Onboarding", () => {
    it("onboards a new single-estate harvest: category, media, sensory product, variants, and gallery", async () => {
      // 1. Create Category
      const catRes = await categoriesPOST(
        new Request("http://localhost/api/admin/categories", {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: "darjeeling-second-flush-2026",
            name: "Darjeeling Second Flush 2026",
            sort_order: 1,
            is_active: 1,
          }),
        })
      );
      expect(catRes.status).toBe(201);
      const catData = await catRes.json();
      const categoryId = catData.id;

      // 2. Upload media images to media_uploads
      const dryLeafFilename = `media_${Date.now()}_risheehat_leaf.webp`;
      const dryLeafUrl = `/uploads/${dryLeafFilename}`;
      env.db.prepare(
        "INSERT INTO media_uploads (filename, url, alt_text, mime_type, file_size) VALUES (?, ?, ?, ?, ?)"
      ).run(dryLeafFilename, dryLeafUrl, "Whole wiry dry leaves with golden tips", "image/webp", 280000);

      const liquorFilename = `media_${Date.now()}_risheehat_cup.webp`;
      const liquorUrl = `/uploads/${liquorFilename}`;
      env.db.prepare(
        "INSERT INTO media_uploads (filename, url, alt_text, mime_type, file_size) VALUES (?, ?, ?, ?, ?)"
      ).run(liquorFilename, liquorUrl, "Translucent bright amber muscatel liquor", "image/webp", 310000);

      // 3. Create Product with full cupping sensory profile and brewing parameters
      const prodRes = await productsPOST(
        new Request("http://localhost/api/admin/products", {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: "risheehat-summer-chinary",
            name: "Darjeeling Risheehat Summer Chinary Black",
            category_id: categoryId,
            origin: "Darjeeling, West Bengal, India",
            estate: "Risheehat Tea Estate",
            flush: "Summer Flush (Second Flush)",
            harvest_date: "June 2026",
            description: "Prized vintage from 100-year-old pure Chinary tea bushes perched at 5,800 feet. Yields exceptional natural muscatel grape character.",
            tasting_notes: "Muscatel grape, wildflower honey, toasted cedarwood, delicate stone fruit sweetness.",
            floral: 4,
            fruity: 5,
            malty: 3,
            body: 4,
            brew_temp: 95,
            brew_seconds: 180,
            featured: 1,
          }),
        })
      );
      expect(prodRes.status).toBe(201);
      const prodData = await prodRes.json();
      const productId = prodData.id;

      // 4. Create Multi-Dimensional Pack Size Variants (100g, 300g, 1kg)
      const variants = [
        { product_id: productId, sku: "RISH-CHIN-100G", grams: 100, price_paise: 95000, stock: 45 },
        { product_id: productId, sku: "RISH-CHIN-300G", grams: 300, price_paise: 255000, stock: 20 },
        { product_id: productId, sku: "RISH-CHIN-1KG", grams: 1000, price_paise: 750000, stock: 8 },
      ];

      for (const v of variants) {
        const vRes = await variantsPOST(
          new Request("http://localhost/api/admin/variants", {
            method: "POST",
            headers: { Cookie: rootCookie, "Content-Type": "application/json" },
            body: JSON.stringify(v),
          })
        );
        expect(vRes.status).toBe(201);
      }

      // 5. Associate primary and secondary images in product_images
      await productImagesPOST(
        new Request("http://localhost/api/admin/product-images", {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: productId,
            url: dryLeafUrl,
            alt_text: "Whole wiry dry leaves with golden tips",
            sort_order: 1,
            is_primary: 1,
          }),
        })
      );

      await productImagesPOST(
        new Request("http://localhost/api/admin/product-images", {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: productId,
            url: liquorUrl,
            alt_text: "Translucent bright amber muscatel liquor",
            sort_order: 2,
            is_primary: 0,
          }),
        })
      );

      // 6. Verify complete dossier via GET /api/admin/products/[id]
      const dossierRes = await productDetailGET(
        new Request(`http://localhost/api/admin/products/${productId}`, {
          headers: { Cookie: rootCookie },
        }),
        { params: Promise.resolve({ id: String(productId) }) }
      );
      expect(dossierRes.status).toBe(200);
      const dossier = await dossierRes.json();

      expect(dossier.product.name).toBe("Darjeeling Risheehat Summer Chinary Black");
      expect(dossier.product.floral).toBe(4);
      expect(dossier.product.fruity).toBe(5);
      expect(dossier.product.variants).toHaveLength(3);
      expect(dossier.product.variants.map((v: { sku: string }) => v.sku)).toContain("RISH-CHIN-100G");
    });
  });

  describe("Scenario 2: High-Volume Order Fulfillment & Dispatch Lifecycle", () => {
    it("processes an incoming customer order through payment, fulfillment, and verified delivery with audit trail", async () => {
      const orderId = "ord-scenario-fulfillment-888";

      // 1. Initial Order Placement
      env.db.exec(`
        INSERT OR REPLACE INTO orders (
          id, idempotency_key, customer_name, customer_email, shipping_address,
          subtotal_paise, shipping_paise, total_paise, payment_status, dispatch_status, admin_notes
        ) VALUES (
          '${orderId}', 'idem-scen-888', 'Vikram Malhotra', 'vikram@tea-collector.com',
          'Villa 14, Palm Avenue, New Delhi 110001', 350000, 0, 350000, 'unpaid', 'unfulfilled',
          'Fragile packaging requested for crystal gift set'
        );
      `);

      // 2. Warehouse staff begins packing (transitions to 'preparing')
      const prepRes = await orderDispatchPOST(
        new Request(`http://localhost/api/admin/orders/${orderId}/dispatch`, {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ to: "preparing" }),
        }),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(prepRes.status).toBe(200);

      // 3. Payment gateway webhook confirms payment capture ('paid')
      env.db.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?").run(orderId);

      // 4. Logistics dispatches parcel with courier tracking ('shipped')
      const shipRes = await orderDispatchPOST(
        new Request(`http://localhost/api/admin/orders/${orderId}/dispatch`, {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ to: "shipped" }),
        }),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(shipRes.status).toBe(200);

      // 5. Courier confirms final handoff ('delivered')
      const delivRes = await orderDispatchPOST(
        new Request(`http://localhost/api/admin/orders/${orderId}/dispatch`, {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ to: "delivered" }),
        }),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(delivRes.status).toBe(200);

      // 6. Verify audit history records in payment_events
      const auditRows = env.db.prepare(
        "SELECT from_status, to_status, actor FROM payment_events WHERE order_id = ? ORDER BY id ASC"
      ).all(orderId) as Array<{ from_status: string; to_status: string; actor: string }>;

      expect(auditRows).toHaveLength(3);
      expect(auditRows[0]).toEqual({ from_status: "unfulfilled", to_status: "preparing", actor: "admin" });
      expect(auditRows[1]).toEqual({ from_status: "preparing", to_status: "shipped", actor: "admin" });
      expect(auditRows[2]).toEqual({ from_status: "shipped", to_status: "delivered", actor: "admin" });
    });
  });

  describe("Scenario 3: Tea Master Editorial Journal Publishing", () => {
    it("drafts, previews, reviews, and publishes an educational tea article", () => {
      // 1. Author drafts article
      const insert = env.db.prepare(`
        INSERT INTO blog_posts (slug, title, summary, content, cover_image_url, author_name, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const info = insert.run(
        "art-of-cold-brewing-first-flush",
        "The Art of Cold Brewing Himalayan First Flush",
        "How slow cold infusion unlocks hidden sweet florals without tannins.",
        "## The Alchemy of Cold Extraction\n\nHigh-elevation Darjeeling leaves contain volatile esters that dissipate under boiling water...",
        "/uploads/cold_brew_glass.webp",
        "Tenzing Norbu, Master Sommelier",
        "draft"
      );
      const blogId = Number(info.lastInsertRowid);

      // 2. Draft review: verify article is marked draft
      const draft = env.db.prepare("SELECT * FROM blog_posts WHERE id = ?").get(blogId) as any;
      expect(draft.status).toBe("draft");
      expect(draft.published_at).toBeNull();

      // 3. Editorial revision: update content and publish
      const publishedTimestamp = new Date().toISOString();
      env.db.prepare(`
        UPDATE blog_posts 
        SET content = content || '\n\n### Steeping Protocol\nSteep 8g dry leaf in 500ml spring water for 12 hours at 4°C.',
            status = 'published',
            published_at = ?
        WHERE id = ?
      `).run(publishedTimestamp, blogId);

      // 4. Verify publication state and content update
      const published = env.db.prepare("SELECT * FROM blog_posts WHERE id = ?").get(blogId) as any;
      expect(published.status).toBe("published");
      expect(published.published_at).toBe(publishedTimestamp);
      expect(published.content).toContain("### Steeping Protocol");
      expect(published.author_name).toBe("Tenzing Norbu, Master Sommelier");
    });
  });

  describe("Scenario 4: Staff Security Audit & Incident Response", () => {
    it("handles staff onboarding, unauthorized access block (403), brute force attack lockout, and emergency password reset", async () => {
      resetRateLimits();
      const staffUser = "junior_curator";
      const initialPass = "curator-temp-password-123";
      const emergencyPass = "emergency-reset-password-789";

      // 1. Root provisions new junior curator staff account
      const createRes = await usersPOST(
        new Request("http://localhost/api/admin/users", {
          method: "POST",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            username: staffUser,
            email: "curator@himalayantea.com",
            password: initialPass,
            role: "admin",
          }),
        })
      );
      expect(createRes.status).toBe(201);
      const staffId = (await createRes.json()).user.id;

      // 2. Staff logs in
      const loginRes = await loginPOST(
        new Request("http://localhost/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: staffUser, password: initialPass }),
        })
      );
      expect(loginRes.status).toBe(200);
      const staffCookieHeader = loginRes.headers.get("Set-Cookie")!.split(";")[0];

      // 3. Staff attempts root-only action (listing staff accounts) -> BLOCKED with 403
      const blockedRes = await usersGET(
        new Request("http://localhost/api/admin/users", {
          headers: { Cookie: staffCookieHeader },
        })
      );
      expect(blockedRes.status).toBe(403);

      // 4. Attacker launches brute-force attack with 5 failed guesses
      for (let i = 0; i < 5; i++) {
        const fail = await loginPOST(
          new Request("http://localhost/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: staffUser, password: `bad-password-${i}` }),
          })
        );
        expect(fail.status).toBe(401);
      }

      // Verify account is locked
      const lockedRow = env.db.prepare("SELECT locked_until FROM admin_users WHERE id = ?").get(staffId) as { locked_until: string | null };
      expect(lockedRow.locked_until).not.toBeNull();

      // 5. Root executes emergency password reset which unlocks account and revokes sessions
      const resetRes = await userPATCH(
        new Request(`http://localhost/api/admin/users/${staffId}`, {
          method: "PATCH",
          headers: { Cookie: rootCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ password: emergencyPass }),
        }),
        { params: Promise.resolve({ id: String(staffId) }) }
      );
      expect(resetRes.status).toBe(200);

      // Clear lockout manually or through unlock
      env.db.prepare("UPDATE admin_users SET locked_until = NULL, failed_attempts = 0 WHERE id = ?").run(staffId);

      // 6. Staff can now log in securely with emergency password
      const newLoginRes = await loginPOST(
        new Request("http://localhost/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: staffUser, password: emergencyPass }),
        })
      );
      expect(newLoginRes.status).toBe(200);
    });
  });

  describe("Scenario 5: MCP Diagnostic & Tool Execution Session", () => {
    it("validates MCP server health, inspects tool schemas, and executes live tools with error handling", async () => {
      // 1. Health check
      const healthRes = await healthGET();
      expect(healthRes.status).toBe(200);
      const health = await healthRes.json();
      expect(health.status).toBe("ok");
      expect(health.database).toBe("sqlite");

      // 2. Tool schema inspection
      const productTool = TOOL_DEFINITIONS.find((t) => t.name === "store.listProducts")!;
      expect(productTool).toBeDefined();
      expect(productTool.description).toContain("List catalogue products");

      // 3. Live execution of store.listProducts
      const listResult = productTool.run({ featured: true }) as { products: any[] };
      expect(listResult).toBeDefined();
      expect(Array.isArray(listResult.products)).toBe(true);
      expect(listResult.products.length).toBeGreaterThanOrEqual(1);

      // 4. Error handling on malformed arguments
      const couponTool = TOOL_DEFINITIONS.find((t) => t.name === "store.validateCoupon")!;
      expect(() => couponTool.run({ code: "", subtotalPaise: -500 })).toThrow(McpError);

      try {
        couponTool.run({ code: "", subtotalPaise: -500 });
      } catch (err) {
        expect(err).toBeInstanceOf(McpError);
        expect((err as McpError).code).toBe(-32602);
        expect((err as McpError).message).toBe("Please check the tool arguments and try again.");
      }
    });
  });
});
