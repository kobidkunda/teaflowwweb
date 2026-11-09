import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  captureLead,
  provisionLeadCoupon,
  getCartByRecoveryToken,
  getLeadByPhone,
  getLeadBySession,
  listCapturedLeads,
  leadCaptureSchema,
} from "@/lib/leads";
import { resetRateLimits } from "@/lib/rateLimit";
import { POST as handleLeadCapturePost } from "@/app/api/leads/capture/route";
import { GET as handleCartRecoverGet } from "@/app/api/cart/recover/route";

function setupTestDb(dbPath: string): InstanceType<typeof Database> {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category_id INTEGER DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      grams INTEGER NOT NULL,
      packaging_format TEXT NOT NULL DEFAULT 'loose_leaf_pouch',
      price_paise INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 50,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('percent','flat')),
      value INTEGER NOT NULL CHECK(value > 0),
      min_subtotal_paise INTEGER NOT NULL DEFAULT 0,
      max_uses INTEGER DEFAULT NULL,
      used_count INTEGER NOT NULL DEFAULT 0,
      starts_at TEXT DEFAULT NULL,
      ends_at TEXT DEFAULT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      max_discount_paise INTEGER CHECK(max_discount_paise IS NULL OR max_discount_paise > 0),
      per_user_limit INTEGER NOT NULL DEFAULT 1 CHECK(per_user_limit > 0),
      single_use_per_customer INTEGER NOT NULL DEFAULT 0 CHECK(single_use_per_customer IN (0, 1)),
      rule_type TEXT NOT NULL DEFAULT 'standard' CHECK(rule_type IN ('standard', 'lead_incentive', 'exclusive_sample')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS visitor_fingerprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      fingerprint_hash TEXT NOT NULL,
      canvas_hash TEXT DEFAULT '',
      webgl_renderer TEXT DEFAULT '',
      audio_signature TEXT DEFAULT '',
      screen_resolution TEXT DEFAULT '',
      timezone TEXT DEFAULT 'UTC',
      device_memory REAL DEFAULT NULL,
      hardware_concurrency INTEGER DEFAULT NULL,
      ip_address TEXT NOT NULL DEFAULT '',
      ip_country TEXT DEFAULT 'India',
      ip_region TEXT DEFAULT '',
      ip_city TEXT DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      phone_number TEXT DEFAULT NULL,
      customer_name TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS abandoned_carts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      customer_phone TEXT DEFAULT NULL,
      customer_name TEXT DEFAULT NULL,
      customer_email TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'abandoned', 'contacted', 'converted', 'ignored')),
      subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_paise >= 0),
      item_count INTEGER NOT NULL DEFAULT 0 CHECK(item_count >= 0),
      applied_coupon_code TEXT REFERENCES coupons(code),
      recovery_token TEXT NOT NULL UNIQUE,
      recovery_channel TEXT DEFAULT 'whatsapp' CHECK(recovery_channel IN ('whatsapp', 'sms', 'email')),
      recovery_sent_at TEXT DEFAULT NULL,
      converted_order_id TEXT DEFAULT NULL,
      admin_notes TEXT NOT NULL DEFAULT '',
      last_active_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      abandoned_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id TEXT NOT NULL REFERENCES abandoned_carts(id) ON DELETE CASCADE,
      variant_id INTEGER NOT NULL REFERENCES variants(id),
      quantity INTEGER NOT NULL CHECK(quantity > 0 AND quantity <= 20),
      unit_price_paise INTEGER NOT NULL CHECK(unit_price_paise >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS captured_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      customer_name TEXT DEFAULT '',
      session_id TEXT NOT NULL,
      cart_id TEXT REFERENCES abandoned_carts(id),
      provisioned_coupon TEXT REFERENCES coupons(code),
      source TEXT NOT NULL DEFAULT 'exit_intent' CHECK(source IN ('exit_intent', 'cart_incentive', 'manual')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed sample product and variant
  db.exec(`
    INSERT INTO products (id, slug, name, description)
    VALUES (1, 'makaibari-first-flush', 'Makaibari First Flush 2026', 'Rare spring pluck');

    INSERT INTO variants (id, product_id, sku, name, grams, price_paise, stock)
    VALUES (101, 1, 'MAK-FF-100G', '100g Loose Leaf Pouch', 100, 75000, 30);

    INSERT INTO variants (id, product_id, sku, name, grams, price_paise, stock)
    VALUES (102, 1, 'MAK-FF-250G', '250g Luxury Tin', 250, 165000, 15);
  `);

  return db;
}

describe("Lead Capture Hook & Incentive Modal (M2)", () => {
  let db: InstanceType<typeof Database>;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(tmpdir(), `hth-leads-test-${randomUUID()}.db`);
    db = setupTestDb(dbPath);
    resetRateLimits();
  });

  afterEach(() => {
    try {
      db.close();
    } catch {}
    if (existsSync(dbPath)) {
      rmSync(dbPath, { force: true });
    }
    resetRateLimits();
  });

  describe("1. Lead Capture Helper (src/lib/leads.ts)", () => {
    it("1.1 provisions COMEBACK10 coupon with lead_incentive rules in coupons table", () => {
      const result = provisionLeadCoupon("COMEBACK10", 10, db);
      expect(result.code).toBe("COMEBACK10");
      expect(result.percent).toBe(10);

      const row = db.prepare("SELECT * FROM coupons WHERE code = 'COMEBACK10'").get() as any;
      expect(row).toBeDefined();
      expect(row.kind).toBe("percent");
      expect(row.value).toBe(10);
      expect(row.single_use_per_customer).toBe(1);
      expect(row.rule_type).toBe("lead_incentive");
      expect(row.max_discount_paise).toBe(50000);
      expect(row.is_active).toBe(1);
    });

    it("1.2 captures lead and saves entry in captured_leads table", () => {
      const sessionId = "sess_lead_01";
      const result = captureLead(
        {
          sessionId,
          phoneNumber: "9832012345",
          customerName: "Ananya Sharma",
          source: "exit_intent",
        },
        db
      );

      expect(result.success).toBe(true);
      expect(result.couponCode).toBe("COMEBACK10");
      expect(result.discountPercent).toBe(10);

      const lead = db.prepare("SELECT * FROM captured_leads WHERE session_id = ?").get(sessionId) as any;
      expect(lead).toBeDefined();
      expect(lead.phone_number).toBe("9832012345");
      expect(lead.customer_name).toBe("Ananya Sharma");
      expect(lead.provisioned_coupon).toBe("COMEBACK10");
      expect(lead.source).toBe("exit_intent");
    });

    it("1.3 sanitizes formatted WhatsApp numbers (+91, spaces, hyphens)", () => {
      const sessionId = "sess_lead_fmt";
      const result = captureLead(
        {
          sessionId,
          phoneNumber: "+91 (983) 201-2345",
          customerName: "Vikram Sen",
        },
        db
      );

      expect(result.success).toBe(true);
      const lead = db.prepare("SELECT * FROM captured_leads WHERE session_id = ?").get(sessionId) as any;
      expect(lead.phone_number).toBe("919832012345");
    });

    it("1.4 links captured phone directly to matching active cart in abandoned_carts", () => {
      const sessionId = "sess_cart_link";
      const cartId = "cart_test_123";
      const recoveryToken = randomUUID();

      // Seed active cart
      db.prepare(`
        INSERT INTO abandoned_carts (id, session_id, status, subtotal_paise, item_count, recovery_token)
        VALUES (?, ?, 'active', 75000, 1, ?)
      `).run(cartId, sessionId, recoveryToken);

      captureLead(
        {
          sessionId,
          phoneNumber: "9832099887",
          customerName: "Rohan Das",
          source: "cart_incentive",
        },
        db
      );

      const updatedCart = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(cartId) as any;
      expect(updatedCart.customer_phone).toBe("9832099887");
      expect(updatedCart.customer_name).toBe("Rohan Das");
      expect(updatedCart.applied_coupon_code).toBe("COMEBACK10");
    });

    it("1.5 links captured phone to visitor_fingerprints record", () => {
      const sessionId = "sess_fp_link";

      // Seed initial visitor fingerprint
      db.prepare(`
        INSERT INTO visitor_fingerprints (session_id, fingerprint_hash, ip_address, user_agent)
        VALUES (?, 'hash_fp_abc', '103.21.244.2', 'Mozilla/5.0')
      `).run(sessionId);

      captureLead(
        {
          sessionId,
          phoneNumber: "9832077665",
          customerName: "Priya Nair",
        },
        db
      );

      const fp = db.prepare("SELECT * FROM visitor_fingerprints WHERE session_id = ?").get(sessionId) as any;
      expect(fp.phone_number).toBe("9832077665");
      expect(fp.customer_name).toBe("Priya Nair");
      expect(fp.fingerprint_hash).toBe("hash_fp_abc");
    });

    it("1.6 creates visitor_fingerprint if none existed yet for session", () => {
      const sessionId = "sess_fresh_fp";
      captureLead(
        {
          sessionId,
          phoneNumber: "9832055443",
          customerName: "Deepak Roy",
        },
        db
      );

      const fp = db.prepare("SELECT * FROM visitor_fingerprints WHERE session_id = ?").get(sessionId) as any;
      expect(fp).toBeDefined();
      expect(fp.phone_number).toBe("9832055443");
      expect(fp.customer_name).toBe("Deepak Roy");
    });

    it("1.7 rejects invalid phone numbers (< 10 digits or > 15 digits)", () => {
      expect(() => {
        captureLead(
          {
            sessionId: "sess_invalid_short",
            phoneNumber: "12345",
          },
          db
        );
      }).toThrow("Invalid phone number: Must be 10-15 digits.");

      expect(() => {
        captureLead(
          {
            sessionId: "sess_invalid_long",
            phoneNumber: "12345678901234567890",
          },
          db
        );
      }).toThrow("Invalid phone number: Must be 10-15 digits.");
    });

    it("1.8 respects store settings for custom lead coupon code & percent", () => {
      db.prepare("INSERT INTO store_settings (key, value) VALUES ('abandoned_lead_coupon_code', 'DARJEELING15')").run();
      db.prepare("INSERT INTO store_settings (key, value) VALUES ('abandoned_lead_discount_percent', '15')").run();

      const result = captureLead(
        {
          sessionId: "sess_custom_settings",
          phoneNumber: "9832011223",
        },
        db
      );

      expect(result.couponCode).toBe("DARJEELING15");
      expect(result.discountPercent).toBe(15);

      const lead = db.prepare("SELECT * FROM captured_leads WHERE session_id = 'sess_custom_settings'").get() as any;
      expect(lead.provisioned_coupon).toBe("DARJEELING15");
    });

    it("1.9 getLeadByPhone and getLeadBySession return captured records", () => {
      const sessionId = "sess_query_test";
      const phone = "9832033445";

      captureLead(
        {
          sessionId,
          phoneNumber: phone,
          customerName: "Sunita Rai",
        },
        db
      );

      const byPhone = getLeadByPhone(phone, db);
      expect(byPhone.length).toBe(1);
      expect((byPhone[0] as any).customer_name).toBe("Sunita Rai");

      const bySession = getLeadBySession(sessionId, db);
      expect(bySession.length).toBe(1);
      expect((bySession[0] as any).phone_number).toBe(phone);

      const listed = listCapturedLeads({ limit: 10 }, db);
      expect(listed.length).toBeGreaterThan(0);
    });

    it("1.10 getCartByRecoveryToken retrieves cart metadata and line items", () => {
      const cartId = "cart_rec_01";
      const recoveryToken = "rec_token_sample_123";

      // Provision coupon first to satisfy foreign key
      provisionLeadCoupon("COMEBACK10", 10, db);

      // Seed cart with items
      db.prepare(`
        INSERT INTO abandoned_carts (id, session_id, status, subtotal_paise, item_count, recovery_token, applied_coupon_code, customer_phone, customer_name)
        VALUES (?, 'sess_rec_01', 'abandoned', 240000, 2, ?, 'COMEBACK10', '9832012345', 'Ananya Sharma')
      `).run(cartId, recoveryToken);

      db.prepare(`
        INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price_paise)
        VALUES (?, 101, 1, 75000), (?, 102, 1, 165000)
      `).run(cartId, cartId);

      const recovered = getCartByRecoveryToken(recoveryToken, db);
      expect(recovered).toBeDefined();
      expect(recovered?.id).toBe(cartId);
      expect(recovered?.subtotalPaise).toBe(240000);
      expect(recovered?.itemCount).toBe(2);
      expect(recovered?.appliedCouponCode).toBe("COMEBACK10");
      expect(recovered?.customerPhone).toBe("9832012345");
      expect(recovered?.customerName).toBe("Ananya Sharma");
      expect(recovered?.items.length).toBe(2);

      const item1 = recovered?.items.find((i) => i.variantId === 101);
      expect(item1?.name).toBe("Makaibari First Flush 2026");
      expect(item1?.pricePaise).toBe(75000);
      expect(item1?.grams).toBe(100);
      expect(item1?.slug).toBe("makaibari-first-flush");

      // Non-existent token returns null
      expect(getCartByRecoveryToken("rec_non_existent", db)).toBeNull();
    });
  });

  describe("2. Schema Validation (leadCaptureSchema)", () => {
    it("2.1 validates valid inputs successfully", () => {
      const valid = leadCaptureSchema.safeParse({
        sessionId: "sess_123",
        phoneNumber: "9832012345",
        customerName: "Kiran",
        source: "exit_intent",
      });
      expect(valid.success).toBe(true);
    });

    it("2.2 rejects missing sessionId", () => {
      const res = leadCaptureSchema.safeParse({
        phoneNumber: "9832012345",
      });
      expect(res.success).toBe(false);
    });

    it("2.3 rejects phone number with fewer than 10 digits", () => {
      const res = leadCaptureSchema.safeParse({
        sessionId: "sess_123",
        phoneNumber: "98320",
      });
      expect(res.success).toBe(false);
    });

    it("2.4 accepts customerName as optional", () => {
      const res = leadCaptureSchema.safeParse({
        sessionId: "sess_123",
        phoneNumber: "+91 98320 12345",
      });
      expect(res.success).toBe(true);
    });
  });

  describe("3. Route Handler Integration (POST /api/leads/capture & GET /api/cart/recover)", () => {
    it("3.1 POST /api/leads/capture returns 200 with couponCode and message", async () => {
      const req = new Request("http://localhost:3000/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess_route_test_01",
          phoneNumber: "9832098765",
          customerName: "Aarav Gupta",
          source: "exit_intent",
        }),
      });

      const res = await handleLeadCapturePost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.couponCode).toBe("COMEBACK10");
      expect(json.discountPercent).toBe(10);
      expect(json.message).toContain("10%");
    });

    it("3.2 POST /api/leads/capture returns 400 for invalid body", async () => {
      const req = new Request("http://localhost:3000/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "",
          phoneNumber: "short",
        }),
      });

      const res = await handleLeadCapturePost(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Validation failed.");
      expect(json.issues).toBeDefined();
    });

    it("3.3 POST /api/leads/capture returns 400 for malformed JSON", async () => {
      const req = new Request("http://localhost:3000/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json{",
      });

      const res = await handleLeadCapturePost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid JSON body.");
    });

    it("3.4 POST /api/leads/capture enforces 30 req/min rate limit", async () => {
      const testIp = "192.168.10.50";

      // Fire 30 allowed requests
      for (let i = 0; i < 30; i++) {
        const req = new Request("http://localhost:3000/api/leads/capture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": testIp,
          },
          body: JSON.stringify({
            sessionId: `sess_rate_limit_${i}`,
            phoneNumber: "9832012345",
          }),
        });
        const res = await handleLeadCapturePost(req);
        expect(res.status).toBe(200);
      }

      // 31st request from same IP is rate limited
      const blockedReq = new Request("http://localhost:3000/api/leads/capture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": testIp,
        },
        body: JSON.stringify({
          sessionId: "sess_rate_limit_31",
          phoneNumber: "9832012345",
        }),
      });

      const blockedRes = await handleLeadCapturePost(blockedReq);
      expect(blockedRes.status).toBe(429);
      const blockedJson = await blockedRes.json();
      expect(blockedJson.error).toContain("Too many requests");
    });

    it("3.5 GET /api/cart/recover returns 400 when token param is missing", async () => {
      const req = new Request("http://localhost:3000/api/cart/recover");
      const res = await handleCartRecoverGet(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Recovery token is required.");
    });

    it("3.6 GET /api/cart/recover returns 404 when token is not found", async () => {
      const req = new Request("http://localhost:3000/api/cart/recover?token=rec_unknown_999");
      const res = await handleCartRecoverGet(req);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Cart recovery token not found or expired.");
    });
  });
});
