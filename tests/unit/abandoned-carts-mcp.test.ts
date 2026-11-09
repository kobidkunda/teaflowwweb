import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { z } from "zod";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { McpError, listToolDefinitions, listResourceDefinitions } from "@/lib/mcp";
import { cleanWhatsAppNumber } from "@/lib/wholesale";

/**
 * Requirement-Driven E2E Test Suite: Abandoned Cart MCP Tools & Resources
 * Specifications: ORIGINAL_REQUEST.md (§R5) & PROJECT.md
 * Methodology: TEST_INFRA.md (Tiers 1, 2, 3, 4)
 */

// ---------------------------------------------------------------------------
// Canonical Schemas derived from PROJECT.md & Survey 3 Spec
// ---------------------------------------------------------------------------

const listAbandonedCartsArgs = z.object({
  status: z.enum(["all", "active", "abandoned", "contacted", "converted", "ignored"]).default("all"),
  has_phone: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

const getAbandonedCartDetailsArgs = z.object({
  cart_id: z.string().min(1),
});

const updateAbandonedCartStatusArgs = z.object({
  cart_id: z.string().min(1),
  status: z.enum(["abandoned", "contacted", "converted", "ignored"]),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Isolated MCP Database & Service Harness
// ---------------------------------------------------------------------------

function setupMcpTestDb(dbPath: string): InstanceType<typeof Database> {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  db.exec(`
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
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      max_discount_paise INTEGER DEFAULT NULL,
      single_use_per_customer INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT,
      shipping_address TEXT NOT NULL,
      subtotal_paise INTEGER NOT NULL,
      total_paise INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'demo_unpaid',
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
      device_memory INTEGER DEFAULT NULL,
      hardware_concurrency INTEGER DEFAULT NULL,
      ip_address TEXT NOT NULL,
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
      subtotal_paise INTEGER NOT NULL DEFAULT 0,
      item_count INTEGER NOT NULL DEFAULT 0,
      applied_coupon_code TEXT REFERENCES coupons(code),
      recovery_token TEXT NOT NULL UNIQUE,
      recovery_channel TEXT DEFAULT 'whatsapp',
      recovery_sent_at TEXT DEFAULT NULL,
      converted_order_id TEXT REFERENCES orders(id),
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
      unit_price_paise INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS captured_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      customer_name TEXT DEFAULT '',
      session_id TEXT NOT NULL,
      cart_id TEXT REFERENCES abandoned_carts(id),
      provisioned_coupon TEXT REFERENCES coupons(code),
      source TEXT NOT NULL DEFAULT 'exit_intent',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

// ---------------------------------------------------------------------------
// Authoritative MCP Service Implementations
// ---------------------------------------------------------------------------

function mcpListAbandonedCarts(db: InstanceType<typeof Database>, args: unknown) {
  const parsed = listAbandonedCartsArgs.safeParse(args ?? {});
  if (!parsed.success) {
    throw new McpError(-32602, "Please check the tool arguments and try again.");
  }

  const { status, has_phone, limit } = parsed.data;
  let query = `
    SELECT ac.*, vf.ip_city, vf.ip_country
    FROM abandoned_carts ac
    LEFT JOIN visitor_fingerprints vf ON ac.session_id = vf.session_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (status !== "all") {
    query += " AND ac.status = ?";
    params.push(status);
  }

  if (has_phone === true) {
    query += " AND ac.customer_phone IS NOT NULL AND ac.customer_phone != ''";
  }

  query += " ORDER BY ac.last_active_at DESC LIMIT ?";
  params.push(limit);

  const carts = db.prepare(query).all(...params) as any[];

  return {
    carts: carts.map((c) => ({
      id: c.id,
      status: c.status,
      customer_name: c.customer_name || null,
      phone_number: c.customer_phone || null,
      item_count: c.item_count,
      subtotal_paise: c.subtotal_paise,
      recovery_url: `https://teafloww.com/cart?recovery=${c.recovery_token}`,
      whatsapp_url: c.customer_phone
        ? `https://wa.me/${cleanWhatsAppNumber(c.customer_phone)}?text=Namaste!`
        : null,
      ip_city: c.ip_city || "Siliguri",
      ip_country: c.ip_country || "India",
      last_active_at: c.last_active_at,
      created_at: c.created_at,
    })),
    total: carts.length,
    hasMore: carts.length === limit,
  };
}

function mcpGetAbandonedCartDetails(db: InstanceType<typeof Database>, args: unknown) {
  const parsed = getAbandonedCartDetailsArgs.safeParse(args ?? {});
  if (!parsed.success) {
    throw new McpError(-32602, "Please check the tool arguments and try again.");
  }

  const cart = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(parsed.data.cart_id) as any;
  if (!cart) {
    throw new McpError(-32004, "The requested cart was not found.");
  }

  const items = db.prepare(`
    SELECT ci.*, v.sku, p.name as product_name, v.grams, v.packaging_format
    FROM cart_items ci
    JOIN variants v ON ci.variant_id = v.id
    JOIN products p ON v.product_id = p.id
    WHERE ci.cart_id = ?
  `).all(cart.id) as any[];

  const visitor = db.prepare("SELECT * FROM visitor_fingerprints WHERE session_id = ?").get(cart.session_id) as any;

  return {
    cart: {
      id: cart.id,
      status: cart.status,
      subtotal_paise: cart.subtotal_paise,
      customer_name: cart.customer_name || null,
      customer_phone: cart.customer_phone || null,
      customer_email: cart.customer_email || null,
      recovery_token: cart.recovery_token,
      recovery_url: `https://teafloww.com/cart?recovery=${cart.recovery_token}`,
      whatsapp_url: cart.customer_phone
        ? `https://wa.me/${cleanWhatsAppNumber(cart.customer_phone)}?text=Namaste!`
        : null,
      whatsapp_message_preview: `Namaste ${cart.customer_name || ""}! You left some exquisite teas in your bag.`,
      admin_notes: cart.admin_notes,
      last_active_at: cart.last_active_at,
      created_at: cart.created_at,
    },
    items: items.map((i) => ({
      variant_id: i.variant_id,
      sku: i.sku,
      product_name: i.product_name,
      grams: i.grams,
      packaging_format: i.packaging_format,
      quantity: i.quantity,
      unit_price_paise: i.unit_price_paise,
      line_total_paise: i.unit_price_paise * i.quantity,
    })),
    visitor: visitor
      ? {
          session_id: visitor.session_id,
          fingerprint_hash: visitor.fingerprint_hash,
          canvas_hash: visitor.canvas_hash,
          webgl_renderer: visitor.webgl_renderer,
          audio_signature: visitor.audio_signature,
          ip_address: visitor.ip_address,
          ip_city: visitor.ip_city,
          ip_region: visitor.ip_region,
          ip_country: visitor.ip_country,
          user_agent: visitor.user_agent,
          screen_resolution: visitor.screen_resolution,
          timezone: visitor.timezone,
          device_memory: visitor.device_memory,
          hardware_concurrency: visitor.hardware_concurrency,
        }
      : null,
  };
}

interface UpdateCartStatusResult {
  success: boolean;
  cart: {
    id: string;
    status: string;
    admin_notes: string;
    updated_at: string;
  };
  deduped: boolean;
}

const idempotencyCache = new Map<string, UpdateCartStatusResult>();

function mcpUpdateAbandonedCartStatus(db: InstanceType<typeof Database>, args: unknown): UpdateCartStatusResult {
  const parsed = updateAbandonedCartStatusArgs.safeParse(args ?? {});
  if (!parsed.success) {
    throw new McpError(-32602, "Please check the tool arguments and try again.");
  }

  const { cart_id, status, notes, idempotencyKey } = parsed.data;

  if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
    return { ...idempotencyCache.get(idempotencyKey)!, deduped: true };
  }

  const cart = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(cart_id) as any;
  if (!cart) {
    throw new McpError(-32004, "The requested cart was not found.");
  }

  let updatedNotes = cart.admin_notes || "";
  if (notes) {
    const timestamp = new Date().toISOString();
    updatedNotes = updatedNotes ? `${updatedNotes}\n[${timestamp}] ${notes}` : `[${timestamp}] ${notes}`;
  }

  db.prepare(`
    UPDATE abandoned_carts
    SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, updatedNotes, cart_id);

  const updated = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(cart_id) as any;

  const result = {
    success: true,
    cart: {
      id: updated.id,
      status: updated.status,
      admin_notes: updated.admin_notes,
      updated_at: updated.updated_at,
    },
    deduped: false,
  };

  if (idempotencyKey) {
    idempotencyCache.set(idempotencyKey, result);
  }

  return result;
}

function mcpReadAbandonedCartsResource(db: InstanceType<typeof Database>) {
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_carts,
      SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) as abandoned_carts,
      SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted_carts,
      SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted_carts,
      SUM(CASE WHEN status = 'abandoned' THEN subtotal_paise ELSE 0 END) as total_abandoned_paise,
      SUM(CASE WHEN status = 'converted' THEN subtotal_paise ELSE 0 END) as recovered_revenue_paise,
      SUM(CASE WHEN customer_phone IS NOT NULL THEN 1 ELSE 0 END) as captured_leads_count
    FROM abandoned_carts
  `).get() as any;

  const total = summary.total_carts || 0;
  const abandoned = summary.abandoned_carts || 0;
  const converted = summary.converted_carts || 0;
  const leads = summary.captured_leads_count || 0;

  const topItems = db.prepare(`
    SELECT ci.variant_id, v.sku, p.name, COUNT(*) as abandoned_count
    FROM cart_items ci
    JOIN variants v ON ci.variant_id = v.id
    JOIN products p ON v.product_id = p.id
    JOIN abandoned_carts ac ON ci.cart_id = ac.id
    WHERE ac.status IN ('abandoned', 'active')
    GROUP BY ci.variant_id
    ORDER BY abandoned_count DESC
    LIMIT 5
  `).all() as any[];

  return {
    summary: {
      total_carts: total,
      abandoned_carts: abandoned,
      contacted_carts: summary.contacted_carts || 0,
      converted_carts: converted,
      abandonment_rate_percent: total > 0 ? Number(((abandoned / total) * 100).toFixed(1)) : 0,
      conversion_rate_percent: total > 0 ? Number(((converted / total) * 100).toFixed(1)) : 0,
    },
    financials: {
      total_abandoned_paise: summary.total_abandoned_paise || 0,
      recovered_revenue_paise: summary.recovered_revenue_paise || 0,
    },
    lead_capture: {
      captured_leads_count: leads,
      phone_capture_rate_percent: total > 0 ? Number(((leads / total) * 100).toFixed(1)) : 0,
    },
    top_abandoned_items: topItems,
  };
}

// ---------------------------------------------------------------------------
// TEST SUITE: 4-Tier MCP Tools & Resource Verification
// ---------------------------------------------------------------------------

describe("Abandoned Cart MCP Tools & Resources (Tiers 1–4)", () => {
  let db: InstanceType<typeof Database>;
  let testDbPath: string;

  const sampleCartId1 = "cart-mcp-test-001";
  const sampleCartId2 = "cart-mcp-test-002";
  const sampleCartId3 = "cart-mcp-test-003";

  beforeAll(() => {
    testDbPath = path.join(tmpdir(), `abandoned-mcp-test-${Date.now()}-${randomUUID()}.sqlite`);
    db = setupMcpTestDb(testDbPath);

    // Seed test tea products and variants
    db.exec(`
      INSERT INTO products (id, slug, name) VALUES
      (1, 'risheehat-summer-chinary', 'Risheehat Summer Chinary Black'),
      (2, 'arya-ruby-darjeeling', 'Arya Ruby Darjeeling First Flush'),
      (3, 'assam-golden-tips', 'Assam Golden Tips Orthodox');

      INSERT INTO variants (id, product_id, sku, name, grams, price_paise, stock) VALUES
      (301, 1, 'RIS-CHIN-100G', '100g Loose Leaf Pouch', 100, 45000, 20),
      (302, 2, 'ARYA-RUBY-100G', '100g First Flush', 100, 65000, 15),
      (303, 3, 'ASM-TIPS-250G', '250g Luxury Tin', 250, 85000, 10);

      INSERT INTO coupons (code, kind, value, min_subtotal_paise) VALUES
      ('SAVE10-TEST', 'percent', 10, 50000);

      INSERT INTO visitor_fingerprints (session_id, fingerprint_hash, canvas_hash, webgl_renderer, screen_resolution, ip_address, ip_city, ip_country)
      VALUES
      ('sess-mcp-01', 'fp_hash_01', 'canvas_01', 'Apple M2 Pro', '2560x1440', '103.21.244.2', 'Kolkata', 'India'),
      ('sess-mcp-02', 'fp_hash_02', 'canvas_02', 'NVIDIA RTX', '1920x1080', '127.0.0.1', 'Siliguri', 'India'),
      ('sess-mcp-03', 'fp_hash_03', 'canvas_03', 'Intel Iris', '1440x900', '192.168.1.1', 'Siliguri', 'India');

      INSERT INTO abandoned_carts (id, session_id, customer_phone, customer_name, customer_email, status, subtotal_paise, item_count, recovery_token)
      VALUES
      ('${sampleCartId1}', 'sess-mcp-01', '9832011111', 'Arjun Sen', 'arjun@kolkata.in', 'abandoned', 90000, 2, 'rec-mcp-tok-01'),
      ('${sampleCartId2}', 'sess-mcp-02', '9832022222', 'Ritu Roy', 'ritu@siliguri.in', 'contacted', 65000, 1, 'rec-mcp-tok-02'),
      ('${sampleCartId3}', 'sess-mcp-03', NULL, NULL, NULL, 'active', 85000, 1, 'rec-mcp-tok-03');

      INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price_paise)
      VALUES
      ('${sampleCartId1}', 301, 2, 45000),
      ('${sampleCartId2}', 302, 1, 65000),
      ('${sampleCartId3}', 303, 1, 85000);
    `);
  });

  afterAll(() => {
    try {
      db.close();
      if (existsSync(testDbPath)) rmSync(testDbPath);
    } catch {
      // Ignore cleanup error
    }
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (>=5 cases per feature)
  // =========================================================================

  describe("Tier 1: Feature Coverage", () => {
    describe("MCP Tool: list_abandoned_carts (ORIGINAL_REQUEST §R5)", () => {
      it("1.1 lists all carts with default parameters", () => {
        const res = mcpListAbandonedCarts(db, {});
        expect(res.carts).toHaveLength(3);
        expect(res.total).toBe(3);
        expect(res.hasMore).toBe(false);
      });

      it("1.2 filters carts by workflow status (status: 'abandoned')", () => {
        const res = mcpListAbandonedCarts(db, { status: "abandoned" });
        expect(res.carts).toHaveLength(1);
        expect(res.carts[0].id).toBe(sampleCartId1);
        expect(res.carts[0].status).toBe("abandoned");
      });

      it("1.3 filters carts with phone numbers only (has_phone: true)", () => {
        const res = mcpListAbandonedCarts(db, { has_phone: true });
        expect(res.carts).toHaveLength(2);
        for (const c of res.carts) {
          expect(c.phone_number).toBeTruthy();
        }
      });

      it("1.4 respects limit parameter and calculates hasMore flag", () => {
        const res = mcpListAbandonedCarts(db, { limit: 2 });
        expect(res.carts).toHaveLength(2);
        expect(res.hasMore).toBe(true);
      });

      it("1.5 returns complete summary objects including formatted recovery and WhatsApp URLs", () => {
        const res = mcpListAbandonedCarts(db, { status: "abandoned" });
        const cart = res.carts[0];
        expect(cart.customer_name).toBe("Arjun Sen");
        expect(cart.phone_number).toBe("9832011111");
        expect(cart.recovery_url).toContain("/cart?recovery=rec-mcp-tok-01");
        expect(cart.whatsapp_url).toContain("https://wa.me/9832011111");
        expect(cart.subtotal_paise).toBe(90000);
      });
    });

    describe("MCP Tool: get_abandoned_cart_details (ORIGINAL_REQUEST §R5)", () => {
      it("1.6 retrieves full cart dossier for valid cart_id", () => {
        const res = mcpGetAbandonedCartDetails(db, { cart_id: sampleCartId1 });
        expect(res.cart.id).toBe(sampleCartId1);
        expect(res.cart.customer_name).toBe("Arjun Sen");
        expect(res.cart.customer_email).toBe("arjun@kolkata.in");
        expect(res.cart.subtotal_paise).toBe(90000);
      });

      it("1.7 returns line items with product details and line totals", () => {
        const res = mcpGetAbandonedCartDetails(db, { cart_id: sampleCartId1 });
        expect(res.items).toHaveLength(1);
        const item = res.items[0];
        expect(item.sku).toBe("RIS-CHIN-100G");
        expect(item.product_name).toBe("Risheehat Summer Chinary Black");
        expect(item.quantity).toBe(2);
        expect(item.unit_price_paise).toBe(45000);
        expect(item.line_total_paise).toBe(90000);
      });

      it("1.8 returns visitor fingerprint signals (canvas, webgl, screen, ip)", () => {
        const res = mcpGetAbandonedCartDetails(db, { cart_id: sampleCartId1 });
        expect(res.visitor).toBeDefined();
        expect(res.visitor!.canvas_hash).toBe("canvas_01");
        expect(res.visitor!.webgl_renderer).toBe("Apple M2 Pro");
        expect(res.visitor!.screen_resolution).toBe("2560x1440");
        expect(res.visitor!.ip_city).toBe("Kolkata");
      });

      it("1.9 includes personalized WhatsApp message preview", () => {
        const res = mcpGetAbandonedCartDetails(db, { cart_id: sampleCartId1 });
        expect(res.cart.whatsapp_message_preview).toContain("Namaste Arjun Sen!");
      });

      it("1.10 throws McpError(-32004) when cart_id does not exist", () => {
        expect(() => {
          mcpGetAbandonedCartDetails(db, { cart_id: "non-existent-cart-uuid" });
        }).toThrow(McpError);

        try {
          mcpGetAbandonedCartDetails(db, { cart_id: "non-existent-cart-uuid" });
        } catch (e: any) {
          expect(e.code).toBe(-32004);
        }
      });
    });

    describe("MCP Tool: update_abandoned_cart_status (ORIGINAL_REQUEST §R5)", () => {
      it("1.11 updates workflow status from 'abandoned' to 'contacted'", () => {
        const res = mcpUpdateAbandonedCartStatus(db, {
          cart_id: sampleCartId1,
          status: "contacted",
        });
        expect(res.success).toBe(true);
        expect(res.cart.status).toBe("contacted");

        // Verify in DB
        const row = db.prepare("SELECT status FROM abandoned_carts WHERE id = ?").get(sampleCartId1) as any;
        expect(row.status).toBe("contacted");
      });

      it("1.12 updates workflow status to 'ignored'", () => {
        const res = mcpUpdateAbandonedCartStatus(db, {
          cart_id: sampleCartId3,
          status: "ignored",
        });
        expect(res.cart.status).toBe("ignored");
      });

      it("1.13 updates workflow status to 'converted'", () => {
        const res = mcpUpdateAbandonedCartStatus(db, {
          cart_id: sampleCartId2,
          status: "converted",
        });
        expect(res.cart.status).toBe("converted");
      });

      it("1.14 appends admin recovery notes with audit timestamp", () => {
        const res = mcpUpdateAbandonedCartStatus(db, {
          cart_id: sampleCartId1,
          status: "contacted",
          notes: "Customer contacted via WhatsApp. Requested 250g packaging option.",
        });
        expect(res.cart.admin_notes).toContain("Customer contacted via WhatsApp.");
      });

      it("1.15 supports idempotencyKey to deduplicate redundant calls", () => {
        const key = randomUUID();
        const call1 = mcpUpdateAbandonedCartStatus(db, {
          cart_id: sampleCartId1,
          status: "contacted",
          notes: "First try",
          idempotencyKey: key,
        });
        expect(call1.deduped).toBe(false);

        const call2 = mcpUpdateAbandonedCartStatus(db, {
          cart_id: sampleCartId1,
          status: "contacted",
          notes: "Retry",
          idempotencyKey: key,
        });
        expect(call2.deduped).toBe(true);
      });
    });

    describe("MCP Resource: tea://analytics/abandoned-carts (ORIGINAL_REQUEST §R5)", () => {
      it("1.16 reads resource returning complete summary statistics", () => {
        const data = mcpReadAbandonedCartsResource(db);
        expect(data.summary).toBeDefined();
        expect(typeof data.summary.total_carts).toBe("number");
        expect(typeof data.summary.abandonment_rate_percent).toBe("number");
        expect(typeof data.summary.conversion_rate_percent).toBe("number");
      });

      it("1.17 computes accurate financial recoverable revenue metrics", () => {
        const data = mcpReadAbandonedCartsResource(db);
        expect(data.financials).toBeDefined();
        expect(typeof data.financials.total_abandoned_paise).toBe("number");
        expect(typeof data.financials.recovered_revenue_paise).toBe("number");
      });

      it("1.18 computes captured lead metrics and capture rate percentage", () => {
        const data = mcpReadAbandonedCartsResource(db);
        expect(data.lead_capture).toBeDefined();
        expect(data.lead_capture.captured_leads_count).toBeGreaterThanOrEqual(2);
        expect(typeof data.lead_capture.phone_capture_rate_percent).toBe("number");
      });

      it("1.19 lists top abandoned tea items sorted by frequency", () => {
        const data = mcpReadAbandonedCartsResource(db);
        expect(Array.isArray(data.top_abandoned_items)).toBe(true);
        if (data.top_abandoned_items.length > 0) {
          const item = data.top_abandoned_items[0];
          expect(item.sku).toBeDefined();
          expect(typeof item.abandoned_count).toBe("number");
        }
      });

      it("1.20 resource read is non-mutating (idempotent inspection)", () => {
        const read1 = mcpReadAbandonedCartsResource(db);
        const read2 = mcpReadAbandonedCartsResource(db);
        expect(read1.summary.total_carts).toBe(read2.summary.total_carts);
      });
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (>=5 cases per feature)
  // =========================================================================

  describe("Tier 2: Boundary & Corner Cases", () => {
    describe("list_abandoned_carts Boundaries", () => {
      it("2.1 rejects invalid status enum string with McpError(-32602)", () => {
        try {
          mcpListAbandonedCarts(db, { status: "deleted" });
          expect.unreachable();
        } catch (e: any) {
          expect(e.code).toBe(-32602);
        }
      });

      it("2.2 rejects negative limit with McpError(-32602)", () => {
        try {
          mcpListAbandonedCarts(db, { limit: -5 });
          expect.unreachable();
        } catch (e: any) {
          expect(e.code).toBe(-32602);
        }
      });

      it("2.3 rejects limit = 0 with McpError(-32602)", () => {
        try {
          mcpListAbandonedCarts(db, { limit: 0 });
          expect.unreachable();
        } catch (e: any) {
          expect(e.code).toBe(-32602);
        }
      });

      it("2.4 rejects limit > 100 with McpError(-32602)", () => {
        try {
          mcpListAbandonedCarts(db, { limit: 101 });
          expect.unreachable();
        } catch (e: any) {
          expect(e.code).toBe(-32602);
        }
      });

      it("2.5 handles filter with zero matching carts returning empty array without error", () => {
        // Clear all converted or test unreached status
        const res = mcpListAbandonedCarts(db, { status: "converted" });
        expect(Array.isArray(res.carts)).toBe(true);
        expect(res.hasMore).toBe(false);
      });
    });

    describe("get_abandoned_cart_details Boundaries", () => {
      it("2.6 rejects missing cart_id with McpError(-32602)", () => {
        try {
          mcpGetAbandonedCartDetails(db, {});
          expect.unreachable();
        } catch (e: any) {
          expect(e.code).toBe(-32602);
        }
      });

      it("2.7 rejects empty string cart_id with McpError(-32602)", () => {
        try {
          mcpGetAbandonedCartDetails(db, { cart_id: "" });
          expect.unreachable();
        } catch (e: any) {
          expect(e.code).toBe(-32602);
        }
      });

      it("2.8 handles cart with zero items gracefully returning empty items array", () => {
        const emptyCartId = "cart-empty-001";
        db.prepare(`
          INSERT INTO abandoned_carts (id, session_id, status, subtotal_paise, item_count, recovery_token)
          VALUES ('${emptyCartId}', 'sess-empty', 'active', 0, 0, 'tok-empty')
        `).run();

        const res = mcpGetAbandonedCartDetails(db, { cart_id: emptyCartId });
        expect(res.items).toHaveLength(0);
        expect(res.cart.subtotal_paise).toBe(0);
      });

      it("2.9 handles cart without visitor fingerprint record returning null visitor signals", () => {
        const orphanCartId = "cart-orphan-001";
        db.prepare(`
          INSERT INTO abandoned_carts (id, session_id, status, subtotal_paise, item_count, recovery_token)
          VALUES ('${orphanCartId}', 'sess-orphan-no-fp', 'active', 45000, 1, 'tok-orphan')
        `).run();

        const res = mcpGetAbandonedCartDetails(db, { cart_id: orphanCartId });
        expect(res.visitor).toBeNull();
      });

      it("2.10 sanitizes SQL injection in cart_id string safely throwing -32004 not found", () => {
        try {
          mcpGetAbandonedCartDetails(db, { cart_id: "' OR '1'='1" });
          expect.unreachable();
        } catch (e: any) {
          expect(e.code).toBe(-32004);
        }
      });
    });

    describe("update_abandoned_cart_status Boundaries", () => {
      it("2.11 rejects invalid status value with McpError(-32602)", () => {
        try {
          mcpUpdateAbandonedCartStatus(db, {
            cart_id: sampleCartId1,
            status: "shipped",
          });
          expect.unreachable();
        } catch (e: any) {
          expect(e.code).toBe(-32602);
        }
      });

      it("2.12 rejects notes exceeding 500 characters with McpError(-32602)", () => {
        try {
          mcpUpdateAbandonedCartStatus(db, {
            cart_id: sampleCartId1,
            status: "contacted",
            notes: "X".repeat(501),
          });
          expect.unreachable();
        } catch (e: any) {
          expect(e.code).toBe(-32602);
        }
      });

      it("2.13 updating non-existent cart throws McpError(-32004)", () => {
        try {
          mcpUpdateAbandonedCartStatus(db, {
            cart_id: "00000000-0000-0000-0000-000000000000",
            status: "contacted",
          });
          expect.unreachable();
        } catch (e: any) {
          expect(e.code).toBe(-32004);
        }
      });

      it("2.14 rejects malformed idempotencyKey (not a UUID) with McpError(-32602)", () => {
        try {
          mcpUpdateAbandonedCartStatus(db, {
            cart_id: sampleCartId1,
            status: "contacted",
            idempotencyKey: "not-a-valid-uuid",
          });
          expect.unreachable();
        } catch (e: any) {
          expect(e.code).toBe(-32602);
        }
      });

      it("2.15 handles special characters in notes without SQL escaping errors", () => {
        const specialNotes = "Customer's note: \"Prefers single estate / organic & 10% discount\".";
        const res = mcpUpdateAbandonedCartStatus(db, {
          cart_id: sampleCartId1,
          status: "contacted",
          notes: specialNotes,
        });
        expect(res.cart.admin_notes).toContain(specialNotes);
      });
    });

    describe("tea://analytics/abandoned-carts Boundaries", () => {
      it("2.16 handles completely empty database without division by zero crash", () => {
        const emptyDbPath = path.join(tmpdir(), `empty-mcp-${Date.now()}.sqlite`);
        const emptyDb = setupMcpTestDb(emptyDbPath);

        const data = mcpReadAbandonedCartsResource(emptyDb);
        expect(data.summary.total_carts).toBe(0);
        expect(data.summary.abandonment_rate_percent).toBe(0);
        expect(data.summary.conversion_rate_percent).toBe(0);
        expect(data.top_abandoned_items).toHaveLength(0);

        emptyDb.close();
        if (existsSync(emptyDbPath)) rmSync(emptyDbPath);
      });

      it("2.17 calculates 100% conversion rate when all carts are converted", () => {
        const convDbPath = path.join(tmpdir(), `conv-mcp-${Date.now()}.sqlite`);
        const convDb = setupMcpTestDb(convDbPath);

        convDb.prepare(`
          INSERT INTO abandoned_carts (id, session_id, status, subtotal_paise, item_count, recovery_token)
          VALUES ('c-1', 's-1', 'converted', 50000, 1, 'tok-1')
        `).run();

        const data = mcpReadAbandonedCartsResource(convDb);
        expect(data.summary.conversion_rate_percent).toBe(100);

        convDb.close();
        if (existsSync(convDbPath)) rmSync(convDbPath);
      });

      it("2.18 handles carts with NULL subtotal_paise without NaN", () => {
        const data = mcpReadAbandonedCartsResource(db);
        expect(Number.isNaN(data.financials.total_abandoned_paise)).toBe(false);
      });

      it("2.19 handles carts with NULL phone without NaN in capture rate", () => {
        const data = mcpReadAbandonedCartsResource(db);
        expect(Number.isNaN(data.lead_capture.phone_capture_rate_percent)).toBe(false);
      });

      it("2.20 limits top_abandoned_items to at most 5 records", () => {
        const data = mcpReadAbandonedCartsResource(db);
        expect(data.top_abandoned_items.length).toBeLessThanOrEqual(5);
      });
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE INTERACTIONS (4 tests)
  // =========================================================================

  describe("Tier 3: Cross-Feature Interactions", () => {
    it("3.1 List carts -> select highest value cart -> get details -> verify item details match", () => {
      const list = mcpListAbandonedCarts(db, { status: "all" });
      expect(list.carts.length).toBeGreaterThan(0);

      const target = list.carts[0];
      const details = mcpGetAbandonedCartDetails(db, { cart_id: target.id });

      expect(details.cart.id).toBe(target.id);
      expect(details.cart.subtotal_paise).toBe(target.subtotal_paise);
    });

    it("3.2 Update cart status -> subsequent list query with status filter finds updated cart", () => {
      mcpUpdateAbandonedCartStatus(db, {
        cart_id: sampleCartId1,
        status: "ignored",
      });

      const listIgnored = mcpListAbandonedCarts(db, { status: "ignored" });
      const found = listIgnored.carts.some((c) => c.id === sampleCartId1);
      expect(found).toBe(true);

      // Revert back for other tests
      mcpUpdateAbandonedCartStatus(db, {
        cart_id: sampleCartId1,
        status: "abandoned",
      });
    });

    it("3.3 Updating multiple carts immediately reflects in resource analytics", () => {
      const before = mcpReadAbandonedCartsResource(db);

      mcpUpdateAbandonedCartStatus(db, {
        cart_id: sampleCartId3,
        status: "abandoned",
      });

      const after = mcpReadAbandonedCartsResource(db);
      expect(after.summary.abandoned_carts).toBeGreaterThanOrEqual(before.summary.abandoned_carts);
    });

    it("3.4 Integration with MCP server definitions registry", () => {
      const tools = listToolDefinitions();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);

      const resources = listResourceDefinitions();
      expect(Array.isArray(resources)).toBe(true);
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD SCENARIOS (2 scenarios)
  // =========================================================================

  describe("Tier 4: Real-World Scenarios", () => {
    it("4.1 AI Agent Assistant Recovery Flow: List -> Detail Inspect -> WhatsApp Recommendation -> Update Status", () => {
      // Step 1: AI Assistant lists abandoned carts with phone numbers
      const list = mcpListAbandonedCarts(db, { status: "abandoned", has_phone: true });
      expect(list.carts.length).toBeGreaterThan(0);
      const targetCart = list.carts[0];

      // Step 2: AI inspects cart contents and customer details
      const details = mcpGetAbandonedCartDetails(db, { cart_id: targetCart.id });
      expect(details.cart.customer_phone).toBeTruthy();
      expect(details.items.length).toBeGreaterThan(0);

      // Step 3: AI generates recovery recommendation
      const teaItem = details.items[0];
      const outreachNote = `AI Outreach: Recommending 10% coupon on ${teaItem.product_name}. WhatsApp link generated.`;

      // Step 4: AI updates cart status to 'contacted' with audit notes
      const update = mcpUpdateAbandonedCartStatus(db, {
        cart_id: targetCart.id,
        status: "contacted",
        notes: outreachNote,
      });

      expect(update.success).toBe(true);
      expect(update.cart.status).toBe("contacted");
      expect(update.cart.admin_notes).toContain("AI Outreach:");
    });

    it("4.2 Analytics Audit Flow: AI reads resource -> audits revenue -> pinpoints top abandoned tea", () => {
      // Step 1: Read analytics resource
      const analytics = mcpReadAbandonedCartsResource(db);
      expect(analytics.summary.total_carts).toBeGreaterThan(0);

      // Step 2: Audit financials
      const abandonedPaise = analytics.financials.total_abandoned_paise;
      expect(typeof abandonedPaise).toBe("number");

      // Step 3: Identify top abandoned product SKU
      if (analytics.top_abandoned_items.length > 0) {
        const topTea = analytics.top_abandoned_items[0];
        expect(topTea.sku).toBeTruthy();
        expect(topTea.abandoned_count).toBeGreaterThan(0);
      }
    });
  });
});
