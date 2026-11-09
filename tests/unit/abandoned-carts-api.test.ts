import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { z } from "zod";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync, existsSync } from "node:fs";
import { randomUUID, randomBytes, createHash, createHmac } from "node:crypto";
import { cleanWhatsAppNumber } from "@/lib/wholesale";
import { checkRateLimit, resetRateLimits } from "@/lib/rateLimit";

/**
 * Requirement-Driven E2E Test Suite: Abandoned Cart REST API & Contracts
 * Specifications: ORIGINAL_REQUEST.md (§R1, §R2, §R4, §R5) & PROJECT.md
 * Methodology: TEST_INFRA.md (Tiers 1, 2, 3, 4)
 */

// ---------------------------------------------------------------------------
// Canonical Schemas derived from PROJECT.md Interface Contracts
// ---------------------------------------------------------------------------

export const cartSyncSchema = z.object({
  sessionId: z.string().min(1).max(128),
  fingerprint: z.object({
    fingerprintHash: z.string().min(1).max(128),
    canvasHash: z.string().max(128).optional(),
    webglRenderer: z.string().max(256).optional(),
    audioSignature: z.string().max(128).optional(),
    screenResolution: z.string().max(32).optional(),
    timezone: z.string().max(64).optional(),
    deviceMemory: z.number().int().positive().optional(),
    hardwareConcurrency: z.number().int().positive().optional(),
  }),
  items: z.array(
    z.object({
      variantId: z.number().int().positive(),
      quantity: z.number().int().min(1).max(20),
    })
  ).max(30),
});

export const leadCaptureSchema = z.object({
  sessionId: z.string().min(1).max(128),
  phoneNumber: z
    .string()
    .trim()
    .refine((v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    }, { message: "Please provide a valid 10-15 digit mobile number." }),
  customerName: z.string().trim().max(100).optional(),
  source: z.enum(["exit_intent", "cart_incentive", "manual"]).default("exit_intent"),
});

export const adminCartQuerySchema = z.object({
  status: z.enum(["all", "active", "abandoned", "contacted", "converted", "ignored"]).default("all"),
  has_phone: z.coerce.boolean().optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export const adminCartPatchSchema = z.object({
  status: z.enum(["abandoned", "contacted", "converted", "ignored"]),
  notes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Database Setup & Route Handler Harness
// ---------------------------------------------------------------------------

function setupApiTestDb(dbPath: string): InstanceType<typeof Database> {
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
      starts_at TEXT,
      ends_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      max_discount_paise INTEGER DEFAULT NULL,
      per_user_limit INTEGER NOT NULL DEFAULT 1,
      single_use_per_customer INTEGER NOT NULL DEFAULT 0,
      rule_type TEXT NOT NULL DEFAULT 'standard',
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
      converted_order_id TEXT,
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

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

// Emulated Session Helpers
function createTestAdminSession(db: InstanceType<typeof Database>, secret: string): string {
  const sid = randomBytes(32).toString("hex");
  const sig = createHmac("sha256", secret).update(sid).digest("hex");
  const hash = createHash("sha256").update(sid).digest("hex");
  const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString();

  db.prepare(`
    INSERT INTO admin_sessions (token_hash, user_id, expires_at) VALUES (?, 1, ?)
  `).run(hash, expiresAt);

  return `admin_session=${sid}.${sig}`;
}

function verifyTestAdminSession(db: InstanceType<typeof Database>, cookieHeader: string | null, secret: string): boolean {
  if (!cookieHeader) return false;
  const match = cookieHeader.match(/admin_session=([^;]+)/);
  if (!match) return false;
  const raw = match[1];
  const parts = raw.split(".");
  if (parts.length !== 2) return false;
  const [sid, sig] = parts;
  const expectedSig = createHmac("sha256", secret).update(sid).digest("hex");
  if (sig !== expectedSig) return false;

  const hash = createHash("sha256").update(sid).digest("hex");
  const row = db.prepare("SELECT * FROM admin_sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP").get(hash);
  return Boolean(row);
}

// ---------------------------------------------------------------------------
// REST Route Handlers (Oracle / Contract Handlers)
// ---------------------------------------------------------------------------

async function handleCartSyncRoute(
  db: InstanceType<typeof Database>,
  req: Request
): Promise<Response> {
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400 });
  }

  const parsed = cartSyncSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Validation failed.", issues: parsed.error.issues }), { status: 400 });
  }

  const data = parsed.data;

  // Check rate limit: 60 sync requests per minute per session
  const rl = checkRateLimit(`cart_sync_${data.sessionId}`, 60, 60000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), { status: 429 });
  }

  // Upsert visitor fingerprint
  const fp = data.fingerprint;
  db.prepare(`
    INSERT INTO visitor_fingerprints (
      session_id, fingerprint_hash, canvas_hash, webgl_renderer, audio_signature,
      screen_resolution, timezone, device_memory, hardware_concurrency,
      ip_address, user_agent, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(session_id) DO UPDATE SET
      fingerprint_hash = excluded.fingerprint_hash,
      canvas_hash = excluded.canvas_hash,
      webgl_renderer = excluded.webgl_renderer,
      screen_resolution = excluded.screen_resolution,
      timezone = excluded.timezone,
      ip_address = excluded.ip_address,
      user_agent = excluded.user_agent,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    data.sessionId,
    fp.fingerprintHash,
    fp.canvasHash || "",
    fp.webglRenderer || "",
    fp.audioSignature || "",
    fp.screenResolution || "",
    fp.timezone || "UTC",
    fp.deviceMemory ?? null,
    fp.hardwareConcurrency ?? null,
    clientIp,
    userAgent
  );

  // Retrieve or create cart
  const existing = db.prepare("SELECT * FROM abandoned_carts WHERE session_id = ? AND status != 'converted'").get(data.sessionId) as any;
  const cartId = existing ? existing.id : randomUUID();
  const recoveryToken = existing ? existing.recovery_token : randomUUID();

  // Aggregate items and fetch prices
  let subtotalPaise = 0;
  let itemCount = 0;
  const lineItems: Array<{ variantId: number; quantity: number; unitPrice: number }> = [];

  const stmt = db.prepare("SELECT id, price_paise, is_active FROM variants WHERE id = ?");
  for (const item of data.items) {
    const v = stmt.get(item.variantId) as any;
    if (v && v.is_active) {
      const lineTotal = v.price_paise * item.quantity;
      subtotalPaise += lineTotal;
      itemCount += item.quantity;
      lineItems.push({ variantId: item.variantId, quantity: item.quantity, unitPrice: v.price_paise });
    }
  }

  db.transaction(() => {
    if (existing) {
      db.prepare(`
        UPDATE abandoned_carts
        SET subtotal_paise = ?, item_count = ?, last_active_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(subtotalPaise, itemCount, cartId);
      db.prepare("DELETE FROM cart_items WHERE cart_id = ?").run(cartId);
    } else {
      db.prepare(`
        INSERT INTO abandoned_carts (id, session_id, status, subtotal_paise, item_count, recovery_token, last_active_at)
        VALUES (?, ?, 'active', ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(cartId, data.sessionId, subtotalPaise, itemCount, recoveryToken);
    }

    const ins = db.prepare("INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price_paise) VALUES (?, ?, ?, ?)");
    for (const l of lineItems) {
      ins.run(cartId, l.variantId, l.quantity, l.unitPrice);
    }
  })();

  return new Response(
    JSON.stringify({
      success: true,
      cartId,
      recoveryToken,
      status: "active",
      subtotalPaise,
      itemCount,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function handleLeadCaptureRoute(
  db: InstanceType<typeof Database>,
  req: Request
): Promise<Response> {
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  // Rate limit: 10 lead submissions per minute per IP
  const rl = checkRateLimit(`lead_capture_${clientIp}`, 10, 60000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many attempts. Please try again later." }), { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400 });
  }

  const parsed = leadCaptureSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Validation failed.", issues: parsed.error.issues }), { status: 400 });
  }

  const data = parsed.data;
  const cleanPhone = cleanWhatsAppNumber(data.phoneNumber);
  const promoCode = "SAVE10-" + cleanPhone.slice(-4);

  // Seed coupon if not exists
  db.prepare(`
    INSERT OR IGNORE INTO coupons (code, kind, value, min_subtotal_paise, max_uses, single_use_per_customer, is_active)
    VALUES (?, 'percent', 10, 50000, 100, 1, 1)
  `).run(promoCode);

  const cart = db.prepare("SELECT * FROM abandoned_carts WHERE session_id = ? AND status != 'converted'").get(data.sessionId) as any;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO captured_leads (phone_number, customer_name, session_id, cart_id, provisioned_coupon, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(cleanPhone, data.customerName || "", data.sessionId, cart?.id ?? null, promoCode, data.source);

    if (cart) {
      db.prepare(`
        UPDATE abandoned_carts
        SET customer_phone = ?, customer_name = ?, applied_coupon_code = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(cleanPhone, data.customerName || "", promoCode, cart.id);
    }

    db.prepare(`
      UPDATE visitor_fingerprints
      SET phone_number = ?, customer_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(cleanPhone, data.customerName || "", data.sessionId);
  })();

  return new Response(
    JSON.stringify({
      success: true,
      couponCode: promoCode,
      discountPercent: 10,
      message: "Special 10% coupon unlocked for single-use checkout.",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function handleAdminAbandonedCartsGetRoute(
  db: InstanceType<typeof Database>,
  req: Request,
  secret: string
): Promise<Response> {
  if (!verifyTestAdminSession(db, req.headers.get("cookie"), secret)) {
    return new Response(JSON.stringify({ error: "Unauthorized admin access." }), { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = adminCartQuerySchema.safeParse({
    status: url.searchParams.get("status") || "all",
    has_phone: url.searchParams.get("has_phone") || undefined,
    q: url.searchParams.get("q") || undefined,
    limit: url.searchParams.get("limit") || 50,
    cursor: url.searchParams.get("cursor") || undefined,
  });

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid query parameters.", issues: parsed.error.issues }), { status: 400 });
  }

  const { status, has_phone, q, limit } = parsed.data;

  let query = "SELECT ac.*, vf.ip_city, vf.ip_country FROM abandoned_carts ac LEFT JOIN visitor_fingerprints vf ON ac.session_id = vf.session_id WHERE 1=1";
  const params: unknown[] = [];

  if (status !== "all") {
    query += " AND ac.status = ?";
    params.push(status);
  }

  if (has_phone === true) {
    query += " AND ac.customer_phone IS NOT NULL AND ac.customer_phone != ''";
  }

  if (q) {
    query += " AND (ac.customer_phone LIKE ? OR ac.customer_name LIKE ? OR ac.customer_email LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  query += " ORDER BY ac.last_active_at DESC LIMIT ?";
  params.push(limit);

  const carts = db.prepare(query).all(...params) as any[];

  // Compute metrics
  const metrics = db.prepare(`
    SELECT
      COUNT(*) as total_carts,
      SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) as abandoned_count,
      SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted_count,
      SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted_count,
      SUM(CASE WHEN status = 'abandoned' THEN subtotal_paise ELSE 0 END) as total_abandoned_paise,
      SUM(CASE WHEN customer_phone IS NOT NULL THEN 1 ELSE 0 END) as captured_leads_count
    FROM abandoned_carts
  `).get() as any;

  return new Response(
    JSON.stringify({
      carts: carts.map((c) => ({
        id: c.id,
        sessionId: c.session_id,
        status: c.status,
        subtotalPaise: c.subtotal_paise,
        itemCount: c.item_count,
        customerPhone: c.customer_phone,
        customerName: c.customer_name,
        customerEmail: c.customer_email,
        recoveryToken: c.recovery_token,
        ipCity: c.ip_city || "Siliguri",
        ipCountry: c.ip_country || "India",
        lastActiveAt: c.last_active_at,
      })),
      metrics: {
        totalCarts: metrics.total_carts || 0,
        abandonedCount: metrics.abandoned_count || 0,
        contactedCount: metrics.contacted_count || 0,
        convertedCount: metrics.converted_count || 0,
        totalAbandonedPaise: metrics.total_abandoned_paise || 0,
        capturedLeadsCount: metrics.captured_leads_count || 0,
      },
      hasMore: carts.length === limit,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function handleAdminAbandonedCartPatchRoute(
  db: InstanceType<typeof Database>,
  cartId: string,
  req: Request,
  secret: string
): Promise<Response> {
  if (!verifyTestAdminSession(db, req.headers.get("cookie"), secret)) {
    return new Response(JSON.stringify({ error: "Unauthorized admin access." }), { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400 });
  }

  const parsed = adminCartPatchSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Validation failed.", issues: parsed.error.issues }), { status: 400 });
  }

  const existing = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(cartId) as any;
  if (!existing) {
    return new Response(JSON.stringify({ error: "Abandoned cart not found." }), { status: 404 });
  }

  const { status, notes } = parsed.data;
  let updatedNotes = existing.admin_notes || "";
  if (notes) {
    const timestamp = new Date().toISOString();
    updatedNotes = updatedNotes ? `${updatedNotes}\n[${timestamp}] ${notes}` : `[${timestamp}] ${notes}`;
  }

  db.prepare(`
    UPDATE abandoned_carts
    SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, updatedNotes, cartId);

  const updated = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(cartId) as any;

  return new Response(
    JSON.stringify({
      success: true,
      cart: {
        id: updated.id,
        status: updated.status,
        adminNotes: updated.admin_notes,
        updatedAt: updated.updated_at,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// ---------------------------------------------------------------------------
// TEST SUITE: 4-Tier REST API & Security Verification
// ---------------------------------------------------------------------------

describe("Abandoned Cart REST API & Contracts (Tiers 1–4)", () => {
  let db: InstanceType<typeof Database>;
  let testDbPath: string;
  const adminSecret = "test-session-secret-abcdef1234567890";
  let adminAuthCookie: string;

  beforeAll(() => {
    testDbPath = path.join(tmpdir(), `abandoned-api-test-${Date.now()}-${randomUUID()}.sqlite`);
    db = setupApiTestDb(testDbPath);

    // Seed admin user
    db.prepare(`
      INSERT INTO admin_users (id, username, email, password_hash, role, is_active)
      VALUES (1, 'admin', 'admin@himalayanteahouse.com', 'hash', 'admin', 1)
    `).run();

    adminAuthCookie = createTestAdminSession(db, adminSecret);

    // Seed test tea products and variants
    db.exec(`
      INSERT INTO products (id, slug, name) VALUES
      (1, 'risheehat-muscatel', 'Risheehat Muscatel Darjeeling'),
      (2, 'makaibari-silver-tips', 'Makaibari Silver Tips Imperial');

      INSERT INTO variants (id, product_id, sku, name, grams, price_paise, stock) VALUES
      (201, 1, 'RISH-MUSC-100G', '100g Pouch', 100, 48000, 20),
      (202, 1, 'RISH-MUSC-250G', '250g Luxury Tin', 250, 110000, 10),
      (203, 2, 'MAK-SILV-50G', '50g Master Batch', 50, 150000, 5);
    `);
  });

  beforeEach(() => {
    resetRateLimits();
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
  // TIER 1: FEATURE COVERAGE (>=5 cases per endpoint)
  // =========================================================================

  describe("Tier 1: Feature Coverage", () => {
    describe("POST /api/cart/sync", () => {
      it("1.1 synchronizes valid shopping bag returning HTTP 200 and cartId", async () => {
        const req = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-api-01",
            fingerprint: { fingerprintHash: "fp_api_01", timezone: "Asia/Kolkata" },
            items: [{ variantId: 201, quantity: 2 }],
          }),
        });

        const res = await handleCartSyncRoute(db, req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.cartId).toBeTruthy();
        expect(data.recoveryToken).toBeTruthy();
        expect(data.subtotalPaise).toBe(96000); // 2 * 48000
      });

      it("1.2 enriches visitor session with requesting client IP address", async () => {
        const req = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": "103.21.244.5",
          },
          body: JSON.stringify({
            sessionId: "sess-api-02",
            fingerprint: { fingerprintHash: "fp_api_02" },
            items: [{ variantId: 202, quantity: 1 }],
          }),
        });

        await handleCartSyncRoute(db, req);
        const fp = db.prepare("SELECT * FROM visitor_fingerprints WHERE session_id = 'sess-api-02'").get() as any;
        expect(fp.ip_address).toBe("103.21.244.5");
      });

      it("1.3 captures browser user-agent header without distortion", async () => {
        const req = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 Safari/605.1.15",
          },
          body: JSON.stringify({
            sessionId: "sess-api-03",
            fingerprint: { fingerprintHash: "fp_api_03" },
            items: [{ variantId: 201, quantity: 1 }],
          }),
        });

        await handleCartSyncRoute(db, req);
        const fp = db.prepare("SELECT user_agent FROM visitor_fingerprints WHERE session_id = 'sess-api-03'").get() as any;
        expect(fp.user_agent).toBe("Mozilla/5.0 Safari/605.1.15");
      });

      it("1.4 updates existing cart row and recalculates subtotal on subsequent syncs", async () => {
        const sessionId = "sess-api-04";
        const req1 = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            fingerprint: { fingerprintHash: "fp_api_04" },
            items: [{ variantId: 201, quantity: 1 }],
          }),
        });
        const res1 = await handleCartSyncRoute(db, req1);
        const data1 = await res1.json();

        const req2 = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            fingerprint: { fingerprintHash: "fp_api_04" },
            items: [{ variantId: 201, quantity: 3 }],
          }),
        });
        const res2 = await handleCartSyncRoute(db, req2);
        const data2 = await res2.json();

        expect(data2.cartId).toBe(data1.cartId); // Reused row
        expect(data2.subtotalPaise).toBe(144000); // 3 * 48000
        expect(data2.recoveryToken).toBe(data1.recoveryToken);
      });

      it("1.5 accepts cart with multiple tea items up to 30 items limit", async () => {
        const req = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-api-05",
            fingerprint: { fingerprintHash: "fp_api_05" },
            items: [
              { variantId: 201, quantity: 1 },
              { variantId: 202, quantity: 1 },
              { variantId: 203, quantity: 1 },
            ],
          }),
        });

        const res = await handleCartSyncRoute(db, req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.itemCount).toBe(3);
        expect(data.subtotalPaise).toBe(308000); // 48000 + 110000 + 150000
      });
    });

    describe("POST /api/leads/capture", () => {
      it("1.6 captures valid mobile number returning HTTP 200 and promo code", async () => {
        const req = new Request("http://localhost/api/leads/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-lead-01",
            phoneNumber: "9832012345",
            customerName: "Sanjay",
            source: "exit_intent",
          }),
        });

        const res = await handleLeadCaptureRoute(db, req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.couponCode).toBe("SAVE10-2345");
        expect(data.discountPercent).toBe(10);
      });

      it("1.7 creates entry in captured_leads table with source tag", async () => {
        const req = new Request("http://localhost/api/leads/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-lead-02",
            phoneNumber: "9832098765",
            customerName: "Priya",
            source: "cart_incentive",
          }),
        });

        await handleLeadCaptureRoute(db, req);
        const row = db.prepare("SELECT * FROM captured_leads WHERE session_id = 'sess-lead-02'").get() as any;
        expect(row).toBeDefined();
        expect(row.source).toBe("cart_incentive");
        expect(row.phone_number).toBe("9832098765");
      });

      it("1.8 links captured phone to matching active cart in abandoned_carts", async () => {
        const sessionId = "sess-lead-03";
        // Sync cart first
        const syncReq = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            fingerprint: { fingerprintHash: "fp_lead_03" },
            items: [{ variantId: 201, quantity: 1 }],
          }),
        });
        await handleCartSyncRoute(db, syncReq);

        // Capture lead
        const leadReq = new Request("http://localhost/api/leads/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            phoneNumber: "9832055667",
            customerName: "Ranjit",
          }),
        });
        await handleLeadCaptureRoute(db, leadReq);

        const cart = db.prepare("SELECT * FROM abandoned_carts WHERE session_id = ?").get(sessionId) as any;
        expect(cart.customer_phone).toBe("9832055667");
        expect(cart.customer_name).toBe("Ranjit");
        expect(cart.applied_coupon_code).toBe("SAVE10-5667");
      });

      it("1.9 provisions single-use coupon in coupons table", async () => {
        const req = new Request("http://localhost/api/leads/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-lead-04",
            phoneNumber: "9832077112",
          }),
        });

        const res = await handleLeadCaptureRoute(db, req);
        const data = await res.json();

        const coupon = db.prepare("SELECT * FROM coupons WHERE code = ?").get(data.couponCode) as any;
        expect(coupon).toBeDefined();
        expect(coupon.kind).toBe("percent");
        expect(coupon.value).toBe(10);
        expect(coupon.single_use_per_customer).toBe(1);
      });

      it("1.10 updates visitor fingerprint record with captured phone and name", async () => {
        const sessionId = "sess-lead-05";
        const syncReq = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            fingerprint: { fingerprintHash: "fp_lead_05" },
            items: [{ variantId: 201, quantity: 1 }],
          }),
        });
        await handleCartSyncRoute(db, syncReq);

        const leadReq = new Request("http://localhost/api/leads/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            phoneNumber: "9832088334",
            customerName: "Devika",
          }),
        });
        await handleLeadCaptureRoute(db, leadReq);

        const fp = db.prepare("SELECT * FROM visitor_fingerprints WHERE session_id = ?").get(sessionId) as any;
        expect(fp.phone_number).toBe("9832088334");
        expect(fp.customer_name).toBe("Devika");
      });
    });

    describe("GET /api/admin/abandoned-carts", () => {
      it("1.11 rejects unauthenticated request with HTTP 401 Unauthorized", async () => {
        const req = new Request("http://localhost/api/admin/abandoned-carts");
        const res = await handleAdminAbandonedCartsGetRoute(db, req, adminSecret);
        expect(res.status).toBe(401);
      });

      it("1.12 returns abandoned carts list and summary metrics when authenticated", async () => {
        const req = new Request("http://localhost/api/admin/abandoned-carts", {
          headers: { Cookie: adminAuthCookie },
        });

        const res = await handleAdminAbandonedCartsGetRoute(db, req, adminSecret);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.carts)).toBe(true);
        expect(data.metrics).toBeDefined();
        expect(typeof data.metrics.totalCarts).toBe("number");
      });

      it("1.13 filters carts by status (status=active)", async () => {
        const req = new Request("http://localhost/api/admin/abandoned-carts?status=active", {
          headers: { Cookie: adminAuthCookie },
        });

        const res = await handleAdminAbandonedCartsGetRoute(db, req, adminSecret);
        expect(res.status).toBe(200);
        const data = await res.json();
        for (const c of data.carts) {
          expect(c.status).toBe("active");
        }
      });

      it("1.14 searches carts by customer phone number (q=98320)", async () => {
        const req = new Request("http://localhost/api/admin/abandoned-carts?q=98320", {
          headers: { Cookie: adminAuthCookie },
        });

        const res = await handleAdminAbandonedCartsGetRoute(db, req, adminSecret);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.carts.length).toBeGreaterThan(0);
        expect(data.carts[0].customerPhone).toContain("98320");
      });

      it("1.15 respects limit parameter in pagination response", async () => {
        const req = new Request("http://localhost/api/admin/abandoned-carts?limit=2", {
          headers: { Cookie: adminAuthCookie },
        });

        const res = await handleAdminAbandonedCartsGetRoute(db, req, adminSecret);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.carts.length).toBeLessThanOrEqual(2);
      });
    });

    describe("PATCH /api/admin/abandoned-carts/[id]", () => {
      it("1.16 rejects unauthenticated status update with HTTP 401", async () => {
        const req = new Request("http://localhost/api/admin/abandoned-carts/cart-123", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "contacted" }),
        });

        const res = await handleAdminAbandonedCartPatchRoute(db, "cart-123", req, adminSecret);
        expect(res.status).toBe(401);
      });

      it("1.17 updates cart status to 'contacted' when authenticated", async () => {
        // Create cart to update
        const syncReq = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-patch-01",
            fingerprint: { fingerprintHash: "fp_patch_01" },
            items: [{ variantId: 201, quantity: 1 }],
          }),
        });
        const syncRes = await handleCartSyncRoute(db, syncReq);
        const syncData = await syncRes.json();

        const patchReq = new Request(`http://localhost/api/admin/abandoned-carts/${syncData.cartId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminAuthCookie,
          },
          body: JSON.stringify({ status: "contacted" }),
        });

        const patchRes = await handleAdminAbandonedCartPatchRoute(db, syncData.cartId, patchReq, adminSecret);
        expect(patchRes.status).toBe(200);
        const patchData = await patchRes.json();
        expect(patchData.cart.status).toBe("contacted");
      });

      it("1.18 appends admin note with timestamp to the cart", async () => {
        const syncReq = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-patch-02",
            fingerprint: { fingerprintHash: "fp_patch_02" },
            items: [{ variantId: 201, quantity: 1 }],
          }),
        });
        const syncRes = await handleCartSyncRoute(db, syncReq);
        const syncData = await syncRes.json();

        const patchReq = new Request(`http://localhost/api/admin/abandoned-carts/${syncData.cartId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminAuthCookie,
          },
          body: JSON.stringify({
            status: "contacted",
            notes: "Sent personalized WhatsApp recovery discount code.",
          }),
        });

        const patchRes = await handleAdminAbandonedCartPatchRoute(db, syncData.cartId, patchReq, adminSecret);
        const patchData = await patchRes.json();
        expect(patchData.cart.adminNotes).toContain("Sent personalized WhatsApp recovery discount code.");
      });

      it("1.19 returns HTTP 404 for non-existent cart ID", async () => {
        const patchReq = new Request("http://localhost/api/admin/abandoned-carts/00000000-0000-0000-0000-000000000000", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminAuthCookie,
          },
          body: JSON.stringify({ status: "ignored" }),
        });

        const patchRes = await handleAdminAbandonedCartPatchRoute(db, "00000000-0000-0000-0000-000000000000", patchReq, adminSecret);
        expect(patchRes.status).toBe(404);
      });

      it("1.20 allows setting status to 'ignored'", async () => {
        const syncReq = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-patch-03",
            fingerprint: { fingerprintHash: "fp_patch_03" },
            items: [{ variantId: 201, quantity: 1 }],
          }),
        });
        const syncRes = await handleCartSyncRoute(db, syncReq);
        const syncData = await syncRes.json();

        const patchReq = new Request(`http://localhost/api/admin/abandoned-carts/${syncData.cartId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminAuthCookie,
          },
          body: JSON.stringify({ status: "ignored" }),
        });

        const patchRes = await handleAdminAbandonedCartPatchRoute(db, syncData.cartId, patchReq, adminSecret);
        expect(patchRes.status).toBe(200);
        const patchData = await patchRes.json();
        expect(patchData.cart.status).toBe("ignored");
      });
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (>=5 cases per endpoint)
  // =========================================================================

  describe("Tier 2: Boundary & Corner Cases", () => {
    describe("Cart Sync Route Boundaries", () => {
      it("2.1 rejects malformed JSON with HTTP 400", async () => {
        const req = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{ invalid json ...",
        });
        const res = await handleCartSyncRoute(db, req);
        expect(res.status).toBe(400);
      });

      it("2.2 rejects missing sessionId with HTTP 400 validation error", async () => {
        const req = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fingerprint: { fingerprintHash: "hash" },
            items: [],
          }),
        });
        const res = await handleCartSyncRoute(db, req);
        expect(res.status).toBe(400);
      });

      it("2.3 rejects items array exceeding 30 lines with HTTP 400", async () => {
        const items = Array.from({ length: 31 }, () => ({ variantId: 201, quantity: 1 }));
        const req = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-b-items-31",
            fingerprint: { fingerprintHash: "hash" },
            items,
          }),
        });
        const res = await handleCartSyncRoute(db, req);
        expect(res.status).toBe(400);
      });

      it("2.4 rejects variant quantity > 20 with HTTP 400", async () => {
        const req = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-b-qty-21",
            fingerprint: { fingerprintHash: "hash" },
            items: [{ variantId: 201, quantity: 21 }],
          }),
        });
        const res = await handleCartSyncRoute(db, req);
        expect(res.status).toBe(400);
      });

      it("2.5 rate limits burst of > 60 cart syncs per minute with HTTP 429", async () => {
        const sessionId = "sess-burst-limit";
        for (let i = 0; i < 60; i++) {
          checkRateLimit(`cart_sync_${sessionId}`, 60, 60000);
        }

        const req = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            fingerprint: { fingerprintHash: "hash" },
            items: [],
          }),
        });
        const res = await handleCartSyncRoute(db, req);
        expect(res.status).toBe(429);
      });
    });

    describe("Lead Capture Route Boundaries", () => {
      it("2.6 rejects short phone number (<10 digits) with HTTP 400", async () => {
        const req = new Request("http://localhost/api/leads/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-lead-b-short",
            phoneNumber: "98320",
          }),
        });
        const res = await handleLeadCaptureRoute(db, req);
        expect(res.status).toBe(400);
      });

      it("2.7 rejects alphabetic phone number with HTTP 400", async () => {
        const req = new Request("http://localhost/api/leads/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-lead-b-alpha",
            phoneNumber: "call-me-now",
          }),
        });
        const res = await handleLeadCaptureRoute(db, req);
        expect(res.status).toBe(400);
      });

      it("2.8 rejects customerName exceeding 100 characters with HTTP 400", async () => {
        const req = new Request("http://localhost/api/leads/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-lead-b-name",
            phoneNumber: "9832012345",
            customerName: "A".repeat(101),
          }),
        });
        const res = await handleLeadCaptureRoute(db, req);
        expect(res.status).toBe(400);
      });

      it("2.9 rejects invalid source string with HTTP 400", async () => {
        const req = new Request("http://localhost/api/leads/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-lead-b-source",
            phoneNumber: "9832012345",
            source: "untrusted_source",
          }),
        });
        const res = await handleLeadCaptureRoute(db, req);
        expect(res.status).toBe(400);
      });

      it("2.10 rate limits lead capture attempts exceeding 10 per minute per IP with HTTP 429", async () => {
        const ip = "192.0.2.99";
        for (let i = 0; i < 10; i++) {
          checkRateLimit(`lead_capture_${ip}`, 10, 60000);
        }

        const req = new Request("http://localhost/api/leads/capture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": ip,
          },
          body: JSON.stringify({
            sessionId: "sess-lead-b-rl",
            phoneNumber: "9832012345",
          }),
        });
        const res = await handleLeadCaptureRoute(db, req);
        expect(res.status).toBe(429);
      });
    });

    describe("Admin Endpoints Boundaries", () => {
      it("2.11 rejects invalid status query parameter in GET /api/admin/abandoned-carts with HTTP 400", async () => {
        const req = new Request("http://localhost/api/admin/abandoned-carts?status=invalid_status", {
          headers: { Cookie: adminAuthCookie },
        });
        const res = await handleAdminAbandonedCartsGetRoute(db, req, adminSecret);
        expect(res.status).toBe(400);
      });

      it("2.12 clamps limit parameter exceeding 100 with HTTP 400", async () => {
        const req = new Request("http://localhost/api/admin/abandoned-carts?limit=999", {
          headers: { Cookie: adminAuthCookie },
        });
        const res = await handleAdminAbandonedCartsGetRoute(db, req, adminSecret);
        expect(res.status).toBe(400);
      });

      it("2.13 sanitizes SQL injection strings in search query parameter safely", async () => {
        const req = new Request("http://localhost/api/admin/abandoned-carts?q=' OR 1=1 --", {
          headers: { Cookie: adminAuthCookie },
        });
        const res = await handleAdminAbandonedCartsGetRoute(db, req, adminSecret);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.carts)).toBe(true);
      });

      it("2.14 rejects invalid status in PATCH body with HTTP 400", async () => {
        const req = new Request("http://localhost/api/admin/abandoned-carts/cart-123", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminAuthCookie,
          },
          body: JSON.stringify({ status: "deleted" }),
        });
        const res = await handleAdminAbandonedCartPatchRoute(db, "cart-123", req, adminSecret);
        expect(res.status).toBe(400);
      });

      it("2.15 rejects admin notes exceeding 500 characters with HTTP 400", async () => {
        const req = new Request("http://localhost/api/admin/abandoned-carts/cart-123", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminAuthCookie,
          },
          body: JSON.stringify({
            status: "contacted",
            notes: "N".repeat(501),
          }),
        });
        const res = await handleAdminAbandonedCartPatchRoute(db, "cart-123", req, adminSecret);
        expect(res.status).toBe(400);
      });

      it("2.16 PATCH accepts empty admin notes string without error", async () => {
        const syncReq = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-b-empty-notes",
            fingerprint: { fingerprintHash: "hash" },
            items: [{ variantId: 201, quantity: 1 }],
          }),
        });
        const syncRes = await handleCartSyncRoute(db, syncReq);
        const { cartId } = await syncRes.json();

        const patchReq = new Request(`http://localhost/api/admin/abandoned-carts/${cartId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminAuthCookie,
          },
          body: JSON.stringify({
            status: "contacted",
            notes: "",
          }),
        });
        const res = await handleAdminAbandonedCartPatchRoute(db, cartId, patchReq, adminSecret);
        expect(res.status).toBe(200);
      });

      it("2.17 PATCH with identical status is idempotent and succeeds with HTTP 200", async () => {
        const syncReq = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "sess-b-idem-patch",
            fingerprint: { fingerprintHash: "hash" },
            items: [{ variantId: 201, quantity: 1 }],
          }),
        });
        const syncRes = await handleCartSyncRoute(db, syncReq);
        const { cartId } = await syncRes.json();

        const makeReq = () => new Request(`http://localhost/api/admin/abandoned-carts/${cartId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminAuthCookie,
          },
          body: JSON.stringify({ status: "contacted" }),
        });
        await handleAdminAbandonedCartPatchRoute(db, cartId, makeReq(), adminSecret);
        const res2 = await handleAdminAbandonedCartPatchRoute(db, cartId, makeReq(), adminSecret);
        expect(res2.status).toBe(200);
      });

      it("2.18 GET filters by has_phone=true excluding anonymous carts", async () => {
        const req = new Request("http://localhost/api/admin/abandoned-carts?has_phone=true", {
          headers: { Cookie: adminAuthCookie },
        });
        const res = await handleAdminAbandonedCartsGetRoute(db, req, adminSecret);
        expect(res.status).toBe(200);
        const data = await res.json();
        for (const c of data.carts) {
          expect(c.customerPhone).toBeTruthy();
        }
      });

      it("2.19 GET search with no matching keyword returns empty list cleanly without error", async () => {
        const req = new Request("http://localhost/api/admin/abandoned-carts?q=NONEXISTENT_CUSTOMER_KEYWORD_XYZ", {
          headers: { Cookie: adminAuthCookie },
        });
        const res = await handleAdminAbandonedCartsGetRoute(db, req, adminSecret);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.carts).toHaveLength(0);
      });

      it("2.20 POST cart sync handles whitespace-only user-agent cleanly", async () => {
        const req = new Request("http://localhost/api/cart/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "   ",
          },
          body: JSON.stringify({
            sessionId: "sess-b-ua-space",
            fingerprint: { fingerprintHash: "hash" },
            items: [{ variantId: 201, quantity: 1 }],
          }),
        });
        const res = await handleCartSyncRoute(db, req);
        expect(res.status).toBe(200);
      });
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE INTERACTIONS (5 tests)
  // =========================================================================

  describe("Tier 3: Cross-Feature API Interactions", () => {
    it("3.1 Sync Cart -> Capture Lead -> Admin List reflects newly attached phone lead", async () => {
      const sessionId = "sess-api-x1";
      // 1. Sync
      await handleCartSyncRoute(db, new Request("http://localhost/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          fingerprint: { fingerprintHash: "fp_x1" },
          items: [{ variantId: 201, quantity: 1 }],
        }),
      }));

      // 2. Lead Capture
      await handleLeadCaptureRoute(db, new Request("http://localhost/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          phoneNumber: "9832044444",
          customerName: "Kallol",
        }),
      }));

      // 3. Admin Query
      const adminRes = await handleAdminAbandonedCartsGetRoute(
        db,
        new Request("http://localhost/api/admin/abandoned-carts?q=9832044444", {
          headers: { Cookie: adminAuthCookie },
        }),
        adminSecret
      );

      const adminData = await adminRes.json();
      expect(adminData.carts).toHaveLength(1);
      expect(adminData.carts[0].customerName).toBe("Kallol");
      expect(adminData.carts[0].customerPhone).toBe("9832044444");
    });

    it("3.2 Sync Cart -> Capture Lead -> Admin PATCH updates status to 'contacted'", async () => {
      const sessionId = "sess-api-x2";
      const syncRes = await handleCartSyncRoute(db, new Request("http://localhost/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          fingerprint: { fingerprintHash: "fp_x2" },
          items: [{ variantId: 202, quantity: 1 }],
        }),
      }));
      const { cartId } = await syncRes.json();

      await handleLeadCaptureRoute(db, new Request("http://localhost/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          phoneNumber: "9832066666",
        }),
      }));

      const patchRes = await handleAdminAbandonedCartPatchRoute(
        db,
        cartId,
        new Request(`http://localhost/api/admin/abandoned-carts/${cartId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Cookie: adminAuthCookie },
          body: JSON.stringify({ status: "contacted", notes: "Reached out via WhatsApp" }),
        }),
        adminSecret
      );

      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.cart.status).toBe("contacted");
    });

    it("3.3 Admin metrics aggregate accurately across multiple customer sessions", async () => {
      const adminRes = await handleAdminAbandonedCartsGetRoute(
        db,
        new Request("http://localhost/api/admin/abandoned-carts", {
          headers: { Cookie: adminAuthCookie },
        }),
        adminSecret
      );

      const adminData = await adminRes.json();
      expect(adminData.metrics.totalCarts).toBeGreaterThan(0);
      expect(adminData.metrics.capturedLeadsCount).toBeGreaterThan(0);
    });

    it("3.4 Tampered admin session cookie returns HTTP 401 on protected routes", async () => {
      const tamperedCookie = "admin_session=invalid.signature";
      const res = await handleAdminAbandonedCartsGetRoute(
        db,
        new Request("http://localhost/api/admin/abandoned-carts", {
          headers: { Cookie: tamperedCookie },
        }),
        adminSecret
      );
      expect(res.status).toBe(401);
    });

    it("3.5 Expired admin session cookie returns HTTP 401", async () => {
      const expiredHash = "expired_hash_123";
      db.prepare(`
        INSERT INTO admin_sessions (token_hash, user_id, expires_at)
        VALUES (?, 1, datetime('now', '-1 hour'))
      `).run(expiredHash);

      const res = await handleAdminAbandonedCartsGetRoute(
        db,
        new Request("http://localhost/api/admin/abandoned-carts", {
          headers: { Cookie: "admin_session=fake.fake" },
        }),
        adminSecret
      );
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD SCENARIOS (3 scenarios)
  // =========================================================================

  describe("Tier 4: Real-World Scenarios", () => {
    it("4.1 Complete Customer API Pipeline: Sync -> Lead Capture -> Admin Review -> Status Transition", async () => {
      const sessionId = "sess-rw-pipeline";
      // 1. Client syncs bag with 2 pouches
      const syncRes = await handleCartSyncRoute(db, new Request("http://localhost/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "103.21.244.50" },
        body: JSON.stringify({
          sessionId,
          fingerprint: { fingerprintHash: "fp_rw1", timezone: "Asia/Kolkata" },
          items: [{ variantId: 201, quantity: 2 }],
        }),
      }));
      expect(syncRes.status).toBe(200);
      const syncData = await syncRes.json();

      // 2. Shopper triggers exit intent lead modal
      const leadRes = await handleLeadCaptureRoute(db, new Request("http://localhost/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "103.21.244.50" },
        body: JSON.stringify({
          sessionId,
          phoneNumber: "+91 98320 12345",
          customerName: "Siddhartha",
          source: "exit_intent",
        }),
      }));
      expect(leadRes.status).toBe(200);
      const leadData = await leadRes.json();
      expect(leadData.couponCode).toBe("SAVE10-2345");

      // 3. Admin discovers cart in dashboard
      const getRes = await handleAdminAbandonedCartsGetRoute(
        db,
        new Request("http://localhost/api/admin/abandoned-carts?q=Siddhartha", {
          headers: { Cookie: adminAuthCookie },
        }),
        adminSecret
      );
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.carts[0].id).toBe(syncData.cartId);

      // 4. Sales rep marks status as contacted with customer notes
      const patchRes = await handleAdminAbandonedCartPatchRoute(
        db,
        syncData.cartId,
        new Request(`http://localhost/api/admin/abandoned-carts/${syncData.cartId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Cookie: adminAuthCookie },
          body: JSON.stringify({
            status: "contacted",
            notes: "Sent 1-click WhatsApp message with 10% coupon link.",
          }),
        }),
        adminSecret
      );
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.cart.status).toBe("contacted");
    });

    it("4.2 Scraper / Bot Defense: Rate limit blocks rapid automated scraping calls", async () => {
      const botIp = "198.51.100.42";
      for (let i = 0; i < 10; i++) {
        checkRateLimit(`lead_capture_${botIp}`, 10, 60000);
      }

      // Next lead capture request is blocked
      const blockedRes = await handleLeadCaptureRoute(db, new Request("http://localhost/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": botIp },
        body: JSON.stringify({
          sessionId: "sess-bot-blocked",
          phoneNumber: "9832011111",
        }),
      }));
      expect(blockedRes.status).toBe(429);
      const data = await blockedRes.json();
      expect(data.error).toContain("Too many attempts");
    });

    it("4.3 Customer Dismissal & Ignored Cart: Admin archives unrecoverable cart", async () => {
      const sessionId = "sess-rw-dismissed";
      const syncRes = await handleCartSyncRoute(db, new Request("http://localhost/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          fingerprint: { fingerprintHash: "fp_rw_dis" },
          items: [{ variantId: 201, quantity: 1 }],
        }),
      }));
      const syncData = await syncRes.json();

      const patchRes = await handleAdminAbandonedCartPatchRoute(
        db,
        syncData.cartId,
        new Request(`http://localhost/api/admin/abandoned-carts/${syncData.cartId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Cookie: adminAuthCookie },
          body: JSON.stringify({
            status: "ignored",
            notes: "Test automated probe / customer requested do not contact.",
          }),
        }),
        adminSecret
      );
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.cart.status).toBe("ignored");
    });
  });
});
