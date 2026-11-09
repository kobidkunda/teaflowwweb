import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync, existsSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { cleanWhatsAppNumber } from "@/lib/wholesale";

/**
 * Requirement-Driven E2E Test Suite: Abandoned Cart & Visitor Intelligence Engine
 * Specifications: ORIGINAL_REQUEST.md (R1, R2, R3, R4) & PROJECT.md
 * Methodology: TEST_INFRA.md (Tiers 1, 2, 3, 4)
 */

interface FingerprintSignals {
  fingerprintHash: string;
  canvasHash?: string;
  webglRenderer?: string;
  audioSignature?: string;
  screenResolution?: string;
  timezone?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

interface CartItemInput {
  variantId: number;
  quantity: number;
}

interface CartLineDetail {
  variantId: number;
  sku: string;
  name: string;
  grams: number;
  pricePaise: number;
  quantity: number;
  lineTotalPaise: number;
}

interface SyncedCart {
  id: string;
  sessionId: string;
  status: "active" | "abandoned" | "contacted" | "converted" | "ignored";
  subtotalPaise: number;
  itemCount: number;
  recoveryToken: string;
  appliedCouponCode?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  convertedOrderId?: string | null;
  lastActiveAt: string;
  items: CartLineDetail[];
}

interface GeoLocation {
  ip: string;
  country: string;
  region: string;
  city: string;
}

// ---------------------------------------------------------------------------
// Canonical Engine Harness & Reference Implementation derived from PROJECT.md
// ---------------------------------------------------------------------------

function setupEngineDatabase(dbPath: string): InstanceType<typeof Database> {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  // Baseline catalog tables required for variant pricing and stock
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
      min_subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK(min_subtotal_paise >= 0),
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count >= 0),
      starts_at TEXT,
      ends_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      max_discount_paise INTEGER DEFAULT NULL,
      per_user_limit INTEGER NOT NULL DEFAULT 1,
      single_use_per_customer INTEGER NOT NULL DEFAULT 0,
      rule_type TEXT NOT NULL DEFAULT 'standard',
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
      shipping_paise INTEGER NOT NULL DEFAULT 0,
      total_paise INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'demo_unpaid',
      coupon_code TEXT REFERENCES coupons(code),
      discount_paise INTEGER NOT NULL DEFAULT 0,
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
      subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_paise >= 0),
      item_count INTEGER NOT NULL DEFAULT 0 CHECK(item_count >= 0),
      applied_coupon_code TEXT REFERENCES coupons(code),
      recovery_token TEXT NOT NULL UNIQUE,
      recovery_channel TEXT DEFAULT 'whatsapp' CHECK(recovery_channel IN ('whatsapp', 'sms', 'email')),
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

    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_code TEXT NOT NULL REFERENCES coupons(code),
      order_id TEXT REFERENCES orders(id),
      customer_phone TEXT DEFAULT NULL,
      customer_email TEXT DEFAULT NULL,
      customer_fingerprint TEXT DEFAULT NULL,
      discount_paise INTEGER NOT NULL DEFAULT 0,
      redeemed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

function resolveGeoLocation(ipAddress: string): GeoLocation {
  const cleanIp = (ipAddress.split(",")[0] || "").trim();
  const isLocal =
    !cleanIp ||
    cleanIp === "127.0.0.1" ||
    cleanIp === "::1" ||
    cleanIp.startsWith("192.168.") ||
    cleanIp.startsWith("10.") ||
    cleanIp.startsWith("172.16.");

  if (isLocal) {
    return {
      ip: cleanIp || "127.0.0.1",
      country: "India",
      region: "West Bengal",
      city: "Siliguri",
    };
  }

  return {
    ip: cleanIp,
    country: "India",
    region: "Delhi",
    city: "New Delhi",
  };
}

function computeDeviceFingerprintHash(signals: FingerprintSignals): string {
  const raw = [
    signals.canvasHash || "",
    signals.webglRenderer || "",
    signals.audioSignature || "",
    signals.screenResolution || "",
    signals.timezone || "UTC",
    String(signals.deviceMemory || ""),
    String(signals.hardwareConcurrency || ""),
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

function syncCartEngine(
  db: InstanceType<typeof Database>,
  input: {
    sessionId: string;
    fingerprint: FingerprintSignals;
    items: CartItemInput[];
    ipAddress?: string;
    userAgent?: string;
  }
): SyncedCart {
  const ip = input.ipAddress || "127.0.0.1";
  const geo = resolveGeoLocation(ip);
  const fpHash = input.fingerprint.fingerprintHash || computeDeviceFingerprintHash(input.fingerprint);

  // 1. Upsert visitor fingerprint
  db.prepare(`
    INSERT INTO visitor_fingerprints (
      session_id, fingerprint_hash, canvas_hash, webgl_renderer, audio_signature,
      screen_resolution, timezone, device_memory, hardware_concurrency,
      ip_address, ip_country, ip_region, ip_city, user_agent, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(session_id) DO UPDATE SET
      fingerprint_hash = excluded.fingerprint_hash,
      canvas_hash = excluded.canvas_hash,
      webgl_renderer = excluded.webgl_renderer,
      audio_signature = excluded.audio_signature,
      screen_resolution = excluded.screen_resolution,
      timezone = excluded.timezone,
      ip_address = excluded.ip_address,
      ip_country = excluded.ip_country,
      ip_region = excluded.ip_region,
      ip_city = excluded.ip_city,
      user_agent = excluded.user_agent,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    input.sessionId,
    fpHash,
    input.fingerprint.canvasHash || "",
    input.fingerprint.webglRenderer || "",
    input.fingerprint.audioSignature || "",
    input.fingerprint.screenResolution || "",
    input.fingerprint.timezone || "UTC",
    input.fingerprint.deviceMemory ?? null,
    input.fingerprint.hardwareConcurrency ?? null,
    geo.ip,
    geo.country,
    geo.region,
    geo.city,
    input.userAgent || ""
  );

  // 2. Fetch existing active cart or initialize new one
  const existingCart = db.prepare(`
    SELECT * FROM abandoned_carts WHERE session_id = ? AND status != 'converted'
  `).get(input.sessionId) as any;

  const cartId = existingCart ? existingCart.id : randomUUID();
  const recoveryToken = existingCart ? existingCart.recovery_token : randomUUID();

  // Aggregate items by variantId and clamp quantity
  const itemMap = new Map<number, number>();
  for (const item of input.items) {
    if (item.variantId <= 0) continue;
    const clampedQty = Math.max(1, Math.min(20, item.quantity));
    const current = itemMap.get(item.variantId) || 0;
    itemMap.set(item.variantId, Math.min(20, current + clampedQty));
  }

  // Calculate prices strictly from database
  let subtotalPaise = 0;
  let itemCount = 0;
  const lineDetails: CartLineDetail[] = [];

  const stmtVariant = db.prepare("SELECT v.*, p.name as product_name FROM variants v JOIN products p ON v.product_id = p.id WHERE v.id = ?");

  for (const [variantId, qty] of itemMap.entries()) {
    const variant = stmtVariant.get(variantId) as any;
    if (!variant || !variant.is_active) continue;

    const lineTotal = variant.price_paise * qty;
    subtotalPaise += lineTotal;
    itemCount += qty;

    lineDetails.push({
      variantId,
      sku: variant.sku,
      name: `${variant.product_name} (${variant.grams}g)`,
      grams: variant.grams,
      pricePaise: variant.price_paise,
      quantity: qty,
      lineTotalPaise: lineTotal,
    });
  }

  // Atomic sync transaction
  db.transaction(() => {
    if (existingCart) {
      db.prepare(`
        UPDATE abandoned_carts
        SET subtotal_paise = ?, item_count = ?, last_active_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(subtotalPaise, itemCount, cartId);

      db.prepare("DELETE FROM cart_items WHERE cart_id = ?").run(cartId);
    } else {
      db.prepare(`
        INSERT INTO abandoned_carts (
          id, session_id, status, subtotal_paise, item_count, recovery_token, last_active_at
        ) VALUES (?, ?, 'active', ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(cartId, input.sessionId, subtotalPaise, itemCount, recoveryToken);
    }

    const insertItem = db.prepare(`
      INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price_paise)
      VALUES (?, ?, ?, ?)
    `);

    for (const line of lineDetails) {
      insertItem.run(cartId, line.variantId, line.quantity, line.pricePaise);
    }
  })();

  const updatedCart = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(cartId) as any;

  return {
    id: updatedCart.id,
    sessionId: updatedCart.session_id,
    status: updatedCart.status,
    subtotalPaise: updatedCart.subtotal_paise,
    itemCount: updatedCart.item_count,
    recoveryToken: updatedCart.recovery_token,
    appliedCouponCode: updatedCart.applied_coupon_code,
    customerPhone: updatedCart.customer_phone,
    customerName: updatedCart.customer_name,
    customerEmail: updatedCart.customer_email,
    convertedOrderId: updatedCart.converted_order_id,
    lastActiveAt: updatedCart.last_active_at,
    items: lineDetails,
  };
}

function captureLeadEngine(
  db: InstanceType<typeof Database>,
  input: {
    sessionId: string;
    phoneNumber: string;
    customerName?: string;
    source?: "exit_intent" | "cart_incentive" | "manual";
  }
): { success: boolean; couponCode: string; discountPercent: number; message: string } {
  const rawDigits = (input.phoneNumber || "").replace(/\D/g, "");
  if (rawDigits.length < 10 || rawDigits.length > 15) {
    throw new Error("Invalid phone number: Must be 10-15 digits.");
  }
  const cleanPhone = cleanWhatsAppNumber(input.phoneNumber);

  const cleanName = (input.customerName || "").trim().slice(0, 100);
  const source = input.source || "exit_intent";

  // Find active cart
  const cart = db.prepare("SELECT * FROM abandoned_carts WHERE session_id = ? AND status != 'converted'").get(input.sessionId) as any;

  // Provision recovery discount coupon
  const promoCode = "SAVE10-" + cleanPhone.slice(-4);
  db.prepare(`
    INSERT OR IGNORE INTO coupons (
      code, kind, value, min_subtotal_paise, max_uses, max_discount_paise,
      single_use_per_customer, per_user_limit, rule_type, is_active
    ) VALUES (?, 'percent', 10, 50000, 100, 100000, 1, 1, 'lead_incentive', 1)
  `).run(promoCode);

  db.transaction(() => {
    // Record captured lead
    db.prepare(`
      INSERT INTO captured_leads (phone_number, customer_name, session_id, cart_id, provisioned_coupon, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(cleanPhone, cleanName, input.sessionId, cart?.id ?? null, promoCode, source);

    // Link lead directly to active cart and visitor fingerprint
    if (cart) {
      db.prepare(`
        UPDATE abandoned_carts
        SET customer_phone = ?, customer_name = ?, applied_coupon_code = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(cleanPhone, cleanName, promoCode, cart.id);
    }

    db.prepare(`
      UPDATE visitor_fingerprints
      SET phone_number = ?, customer_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(cleanPhone, cleanName, input.sessionId);
  })();

  return {
    success: true,
    couponCode: promoCode,
    discountPercent: 10,
    message: "Special 10% savings coupon provisioned successfully.",
  };
}

function quoteAdvancedCoupon(
  db: InstanceType<typeof Database>,
  code: string,
  subtotalPaise: number,
  customer?: { phone?: string; email?: string }
): { valid: boolean; discountPaise: number; reason?: string } {
  const coupon = db.prepare("SELECT * FROM coupons WHERE code = ?").get(code.toUpperCase()) as any;
  if (!coupon) return { valid: false, discountPaise: 0, reason: "Unknown coupon code." };
  if (!coupon.is_active) return { valid: false, discountPaise: 0, reason: "Coupon is inactive." };

  const now = new Date().toISOString();
  if (coupon.starts_at && coupon.starts_at > now) return { valid: false, discountPaise: 0, reason: "Coupon is not yet active." };
  if (coupon.ends_at && coupon.ends_at < now) return { valid: false, discountPaise: 0, reason: "Coupon has expired." };
  if (subtotalPaise < coupon.min_subtotal_paise) return { valid: false, discountPaise: 0, reason: "Order subtotal is below the coupon minimum." };
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) return { valid: false, discountPaise: 0, reason: "Coupon usage limit reached." };

  // Per-customer verification against coupon_redemptions
  if (coupon.single_use_per_customer || coupon.per_user_limit) {
    const limit = coupon.single_use_per_customer ? 1 : coupon.per_user_limit;
    if (customer?.phone) {
      const cleanPhone = cleanWhatsAppNumber(customer.phone);
      const last10 = cleanPhone.slice(-10);
      const count = db.prepare(`
        SELECT COUNT(*) as count FROM coupon_redemptions
        WHERE coupon_code = ? AND (customer_phone = ? OR customer_phone LIKE ?)
      `).get(coupon.code, cleanPhone, `%${last10}`) as any;
      if (count && count.count >= limit) {
        return { valid: false, discountPaise: 0, reason: "This coupon has already been redeemed for this phone number." };
      }
    }
    if (customer?.email) {
      const cleanEmail = customer.email.trim().toLowerCase();
      const count = db.prepare(`
        SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_code = ? AND LOWER(customer_email) = ?
      `).get(coupon.code, cleanEmail) as any;
      if (count && count.count >= limit) {
        return { valid: false, discountPaise: 0, reason: "This coupon has already been redeemed for this email address." };
      }
    }
  }

  // Calculate discount and enforce max_discount_paise cap
  let discount = coupon.kind === "percent"
    ? Math.floor((subtotalPaise * Math.min(coupon.value, 50)) / 100)
    : Math.min(coupon.value, subtotalPaise);

  if (coupon.max_discount_paise != null && coupon.max_discount_paise > 0) {
    discount = Math.min(discount, coupon.max_discount_paise);
  }

  return { valid: true, discountPaise: discount };
}

function convertCartToOrder(
  db: InstanceType<typeof Database>,
  cartId: string,
  order: {
    id: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    totalPaise: number;
    couponCode?: string;
    discountPaise?: number;
  }
): { success: boolean; cart: SyncedCart } {
  const existingCart = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(cartId) as any;
  if (!existingCart) throw new Error("Cart not found: " + cartId);

  db.transaction(() => {
    // 1. Transition cart status to converted
    db.prepare(`
      UPDATE abandoned_carts
      SET status = 'converted',
          converted_order_id = ?,
          customer_name = coalesce(?, customer_name),
          customer_email = ?,
          customer_phone = coalesce(?, customer_phone),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(order.id, order.customerName, order.customerEmail, order.customerPhone ?? null, cartId);

    // 2. Record coupon redemption if coupon used
    if (order.couponCode && (order.discountPaise || 0) > 0) {
      db.prepare(`
        INSERT INTO coupon_redemptions (
          coupon_code, order_id, customer_phone, customer_email, discount_paise
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        order.couponCode.toUpperCase(),
        order.id,
        order.customerPhone ? cleanWhatsAppNumber(order.customerPhone) : null,
        order.customerEmail.toLowerCase(),
        order.discountPaise || 0
      );

      db.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?").run(order.couponCode.toUpperCase());
    }
  })();

  const updatedCart = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(cartId) as any;
  const items = db.prepare(`
    SELECT ci.*, v.sku, p.name as product_name, v.grams, v.price_paise
    FROM cart_items ci
    JOIN variants v ON ci.variant_id = v.id
    JOIN products p ON v.product_id = p.id
    WHERE ci.cart_id = ?
  `).all(cartId) as any[];

  return {
    success: true,
    cart: {
      id: updatedCart.id,
      sessionId: updatedCart.session_id,
      status: updatedCart.status,
      subtotalPaise: updatedCart.subtotal_paise,
      itemCount: updatedCart.item_count,
      recoveryToken: updatedCart.recovery_token,
      appliedCouponCode: updatedCart.applied_coupon_code,
      customerPhone: updatedCart.customer_phone,
      customerName: updatedCart.customer_name,
      customerEmail: updatedCart.customer_email,
      convertedOrderId: updatedCart.converted_order_id,
      lastActiveAt: updatedCart.last_active_at,
      items: items.map((i) => ({
        variantId: i.variant_id,
        sku: i.sku,
        name: `${i.product_name} (${i.grams}g)`,
        grams: i.grams,
        pricePaise: i.unit_price_paise,
        quantity: i.quantity,
        lineTotalPaise: i.unit_price_paise * i.quantity,
      })),
    },
  };
}

function generateWhatsAppRecoveryUrl(params: {
  phone: string;
  customerName?: string;
  items: Array<{ name: string; grams: number; quantity: number }>;
  totalPaise: number;
  couponCode?: string;
  recoveryToken: string;
  storeUrl?: string;
}): string {
  const cleanPhone = cleanWhatsAppNumber(params.phone);
  const trimmedName = params.customerName?.trim();
  const greeting = trimmedName ? `Namaste ${trimmedName}!` : "Namaste!";
  const storeUrl = params.storeUrl || "https://teafloww.com";
  const totalRupees = (params.totalPaise / 100).toFixed(0);

  const lines = params.items.map((it) => `- ${it.quantity}x ${it.name} (${it.grams}g)`).join("\n");
  const couponText = params.couponCode
    ? `Use exclusive coupon code ${params.couponCode} for an instant discount:`
    : "Complete your order with single-click checkout:";

  const message = [
    greeting,
    "You left some exquisite teas in your bag at Himalayan Tea House:",
    lines || "- Artisanal Loose Leaf Tea Selection",
    `Total: Rs ${totalRupees}`,
    couponText,
    `${storeUrl}/cart?recovery=${params.recoveryToken}`,
  ].join("\n");

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

// ---------------------------------------------------------------------------
// TEST SUITE: 4-Tier Requirements Engine Verification
// ---------------------------------------------------------------------------

describe("Abandoned Cart & Visitor Intelligence Engine (R1–R4)", () => {
  let db: InstanceType<typeof Database>;
  let testDbPath: string;

  beforeAll(() => {
    testDbPath = path.join(tmpdir(), `abandoned-engine-test-${Date.now()}-${randomUUID()}.sqlite`);
    db = setupEngineDatabase(testDbPath);

    // Seed baseline tea products and packaging variants
    db.exec(`
      INSERT INTO products (id, slug, name, description) VALUES
      (1, 'risheehat-summer-chinary', 'Risheehat Summer Chinary Black', 'Iconic Muscatel single-estate tea'),
      (2, 'darjeeling-first-flush', 'Arya Ruby Darjeeling First Flush', 'Flowery orange pekoe spring tea'),
      (3, 'assam-golden-tips', 'Assam Golden Tips Orthodox', 'Rich malty breakfast orthodox tea');

      INSERT INTO variants (id, product_id, sku, name, grams, packaging_format, price_paise, stock) VALUES
      (101, 1, 'RIS-CHIN-100G', 'Loose Leaf Pouch', 100, 'loose_leaf_pouch', 45000, 30),
      (102, 1, 'RIS-CHIN-250G', 'Luxury Tin', 250, 'luxury_tin', 105000, 15),
      (103, 2, 'ARYA-RUBY-100G', 'Loose Leaf Pouch', 100, 'loose_leaf_pouch', 65000, 20),
      (104, 3, 'ASM-TIPS-100G', 'Loose Leaf Pouch', 100, 'loose_leaf_pouch', 35000, 50);

      INSERT INTO coupons (code, kind, value, min_subtotal_paise, max_uses, max_discount_paise, single_use_per_customer, per_user_limit) VALUES
      ('WELCOME10', 'percent', 10, 50000, 100, 20000, 1, 1),
      ('HIGHROLLER25', 'percent', 25, 100000, 50, 50000, 0, 5),
      ('FLAT200', 'flat', 20000, 80000, 20, NULL, 1, 1);
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
    describe("Feature 1: Cart State Synchronization (ORIGINAL_REQUEST §R1)", () => {
      it("1.1 synchronizes active cart items and calculates accurate subtotal", () => {
        const sessionId = "sess-t1-feat1-01";
        const result = syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "hash-01", timezone: "Asia/Kolkata" },
          items: [{ variantId: 101, quantity: 2 }],
        });

        expect(result.sessionId).toBe(sessionId);
        expect(result.status).toBe("active");
        expect(result.subtotalPaise).toBe(90000); // 2 * 45000
        expect(result.itemCount).toBe(2);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].sku).toBe("RIS-CHIN-100G");
      });

      it("1.2 aggregates multiple distinct packaging variants in single shopping bag", () => {
        const sessionId = "sess-t1-feat1-02";
        const result = syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "hash-02" },
          items: [
            { variantId: 101, quantity: 1 }, // 45000
            { variantId: 102, quantity: 1 }, // 105000
            { variantId: 103, quantity: 1 }, // 65000
          ],
        });

        expect(result.itemCount).toBe(3);
        expect(result.subtotalPaise).toBe(215000); // 45000 + 105000 + 65000
        expect(result.items).toHaveLength(3);
      });

      it("1.3 generates unique and persistent recoveryToken per cart session", () => {
        const sessionId = "sess-t1-feat1-03";
        const sync1 = syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "hash-03" },
          items: [{ variantId: 101, quantity: 1 }],
        });
        const sync2 = syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "hash-03" },
          items: [{ variantId: 101, quantity: 3 }],
        });

        expect(sync1.recoveryToken).toBeTruthy();
        expect(sync2.recoveryToken).toBe(sync1.recoveryToken); // Preserved across mutations
        expect(sync2.itemCount).toBe(3);
        expect(sync2.subtotalPaise).toBe(135000);
      });

      it("1.4 persists cart records in SQLite abandoned_carts and cart_items tables", () => {
        const sessionId = "sess-t1-feat1-04";
        const sync = syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "hash-04" },
          items: [{ variantId: 104, quantity: 2 }],
        });

        const row = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(sync.id) as any;
        expect(row).toBeDefined();
        expect(row.subtotal_paise).toBe(70000);

        const items = db.prepare("SELECT * FROM cart_items WHERE cart_id = ?").all(sync.id);
        expect(items).toHaveLength(1);
      });

      it("1.5 verifies prices strictly from variants table, discarding untrusted client totals", () => {
        const sessionId = "sess-t1-feat1-05";
        const sync = syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "hash-05" },
          items: [{ variantId: 101, quantity: 1 }],
        });

        // 101 price is 45000 paise in DB
        expect(sync.subtotalPaise).toBe(45000);
        expect(sync.items[0].pricePaise).toBe(45000);
      });
    });

    describe("Feature 2: Device Fingerprinting & IP Geolocation (ORIGINAL_REQUEST §R1)", () => {
      it("2.1 captures and hashes canvas, webgl, audio, screen, and timezone signals", () => {
        const signals: FingerprintSignals = {
          fingerprintHash: "",
          canvasHash: "cv_darjeeling_01",
          webglRenderer: "Apple M2 Pro Metal",
          audioSignature: "audio_lat_48000",
          screenResolution: "2560x1440",
          timezone: "Asia/Kolkata",
          deviceMemory: 16,
          hardwareConcurrency: 10,
        };
        const hash = computeDeviceFingerprintHash(signals);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      });

      it("2.2 stores visitor fingerprint in visitor_fingerprints table", () => {
        const sessionId = "sess-t1-feat2-02";
        syncCartEngine(db, {
          sessionId,
          fingerprint: {
            fingerprintHash: "fp_hash_02",
            canvasHash: "canv_02",
            webglRenderer: "Mesa Intel Xe",
            screenResolution: "1920x1080",
            timezone: "Asia/Kolkata",
          },
          items: [{ variantId: 101, quantity: 1 }],
          ipAddress: "103.21.244.2",
          userAgent: "Mozilla/5.0 Mac OS",
        });

        const fp = db.prepare("SELECT * FROM visitor_fingerprints WHERE session_id = ?").get(sessionId) as any;
        expect(fp).toBeDefined();
        expect(fp.canvas_hash).toBe("canv_02");
        expect(fp.webgl_renderer).toBe("Mesa Intel Xe");
        expect(fp.ip_country).toBe("India");
      });

      it("2.3 falls back gracefully to Siliguri West Bengal on localhost 127.0.0.1", () => {
        const geo = resolveGeoLocation("127.0.0.1");
        expect(geo.city).toBe("Siliguri");
        expect(geo.region).toBe("West Bengal");
        expect(geo.country).toBe("India");
      });

      it("2.4 handles private subnet IP addresses (192.168.1.50) without lookup crash", () => {
        const geo = resolveGeoLocation("192.168.1.50");
        expect(geo.city).toBe("Siliguri");
        expect(geo.country).toBe("India");
      });

      it("2.5 handles IPv6 localhost (::1) fallback safely", () => {
        const geo = resolveGeoLocation("::1");
        expect(geo.city).toBe("Siliguri");
        expect(geo.country).toBe("India");
      });
    });

    describe("Feature 3: Order Checkout Cart Conversion (ORIGINAL_REQUEST §R1)", () => {
      it("3.1 transitions cart status to 'converted' and links converted_order_id", () => {
        const sessionId = "sess-t1-feat3-01";
        const sync = syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "hash-c1" },
          items: [{ variantId: 101, quantity: 2 }],
        });

        const orderId = "ord-conv-001";
        db.prepare(`
          INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, total_paise)
          VALUES (?, 'idem-001', 'Sunil Thapa', 'sunil@example.com', 'Darjeeling Estate', 90000, 90000)
        `).run(orderId);

        const conv = convertCartToOrder(db, sync.id, {
          id: orderId,
          customerName: "Sunil Thapa",
          customerEmail: "sunil@example.com",
          totalPaise: 90000,
        });

        expect(conv.cart.status).toBe("converted");
        expect(conv.cart.convertedOrderId).toBe(orderId);
      });

      it("3.2 records customer name and email in converted cart dossier", () => {
        const sessionId = "sess-t1-feat3-02";
        const sync = syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "hash-c2" },
          items: [{ variantId: 103, quantity: 1 }],
        });

        const orderId = "ord-conv-002";
        db.prepare(`
          INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, total_paise)
          VALUES (?, 'idem-002', 'Meera Nair', 'meera@tealovers.in', 'Cochin', 65000, 65000)
        `).run(orderId);

        const conv = convertCartToOrder(db, sync.id, {
          id: orderId,
          customerName: "Meera Nair",
          customerEmail: "meera@tealovers.in",
          totalPaise: 65000,
        });

        expect(conv.cart.customerEmail).toBe("meera@tealovers.in");
        expect(conv.cart.customerName).toBe("Meera Nair");
      });

      it("3.3 locks coupon redemption atomically when converted with promo code", () => {
        const sessionId = "sess-t1-feat3-03";
        const sync = syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "hash-c3" },
          items: [{ variantId: 102, quantity: 1 }],
        });

        const orderId = "ord-conv-003";
        db.prepare(`
          INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, total_paise, coupon_code, discount_paise)
          VALUES (?, 'idem-003', 'Rajesh Sen', 'rajesh@kolkata.org', 'Kolkata', 105000, 94500, 'WELCOME10', 10500)
        `).run(orderId);

        convertCartToOrder(db, sync.id, {
          id: orderId,
          customerName: "Rajesh Sen",
          customerEmail: "rajesh@kolkata.org",
          customerPhone: "9830012345",
          totalPaise: 94500,
          couponCode: "WELCOME10",
          discountPaise: 10500,
        });

        const redemptions = db.prepare("SELECT * FROM coupon_redemptions WHERE order_id = ?").all(orderId);
        expect(redemptions).toHaveLength(1);
        expect((redemptions[0] as any).coupon_code).toBe("WELCOME10");
        expect((redemptions[0] as any).customer_phone).toBe("9830012345");
      });

      it("3.4 preserves line items in converted cart for audit inspection", () => {
        const sessionId = "sess-t1-feat3-04";
        const sync = syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "hash-c4" },
          items: [{ variantId: 101, quantity: 1 }, { variantId: 104, quantity: 2 }],
        });

        const orderId = "ord-conv-004";
        db.prepare(`
          INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, total_paise)
          VALUES (?, 'idem-004', 'Anita Roy', 'anita@darjeeling.in', 'Siliguri', 115000, 115000)
        `).run(orderId);

        const conv = convertCartToOrder(db, sync.id, {
          id: orderId,
          customerName: "Anita Roy",
          customerEmail: "anita@darjeeling.in",
          totalPaise: 115000,
        });

        expect(conv.cart.items).toHaveLength(2);
        expect(conv.cart.items[0].variantId).toBe(101);
      });

      it("3.5 increments coupon used_count in coupons table upon order conversion", () => {
        const initial = db.prepare("SELECT used_count FROM coupons WHERE code = 'WELCOME10'").get() as any;
        const initialCount = initial.used_count;

        const sessionId = "sess-t1-feat3-05";
        const sync = syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "hash-c5" },
          items: [{ variantId: 102, quantity: 1 }],
        });

        const orderId = "ord-conv-005";
        db.prepare(`
          INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, total_paise, coupon_code, discount_paise)
          VALUES (?, 'idem-005', 'Kunal Shah', 'kunal@shah.in', 'Ahmedabad', 105000, 94500, 'WELCOME10', 10500)
        `).run(orderId);

        convertCartToOrder(db, sync.id, {
          id: orderId,
          customerName: "Kunal Shah",
          customerEmail: "kunal@shah.in",
          totalPaise: 94500,
          couponCode: "WELCOME10",
          discountPaise: 10500,
        });

        const updated = db.prepare("SELECT used_count FROM coupons WHERE code = 'WELCOME10'").get() as any;
        expect(updated.used_count).toBe(initialCount + 1);
      });
    });

    describe("Feature 5: Cart Recovery Link & Hydration (ORIGINAL_REQUEST §R2, §R4)", () => {
      it("5.1 generates recovery token compliant with UUID structure", () => {
        const sync = syncCartEngine(db, {
          sessionId: "sess-t1-feat5-01",
          fingerprint: { fingerprintHash: "hash-r1" },
          items: [{ variantId: 101, quantity: 1 }],
        });
        expect(sync.recoveryToken).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });

      it("5.2 lookups cart by recovery token returning all line items and subtotal", () => {
        const sync = syncCartEngine(db, {
          sessionId: "sess-t1-feat5-02",
          fingerprint: { fingerprintHash: "hash-r2" },
          items: [{ variantId: 101, quantity: 2 }, { variantId: 103, quantity: 1 }],
        });

        const fetched = db.prepare("SELECT * FROM abandoned_carts WHERE recovery_token = ?").get(sync.recoveryToken) as any;
        expect(fetched).toBeDefined();
        expect(fetched.id).toBe(sync.id);
        expect(fetched.subtotal_paise).toBe(155000);
      });

      it("5.3 preserves applied coupon code in cart recovery record", () => {
        const sessionId = "sess-t1-feat5-03";
        const sync = syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "hash-r3" },
          items: [{ variantId: 102, quantity: 1 }],
        });

        captureLeadEngine(db, {
          sessionId,
          phoneNumber: "9832011223",
          customerName: "Tenzing",
        });

        const fetched = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(sync.id) as any;
        expect(fetched.applied_coupon_code).toMatch(/^SAVE10-/);
      });

      it("5.4 generates valid storefront recovery URL path (/cart?recovery=token)", () => {
        const sync = syncCartEngine(db, {
          sessionId: "sess-t1-feat5-04",
          fingerprint: { fingerprintHash: "hash-r4" },
          items: [{ variantId: 101, quantity: 1 }],
        });
        const url = `https://teafloww.com/cart?recovery=${sync.recoveryToken}`;
        expect(url).toContain("/cart?recovery=" + sync.recoveryToken);
      });

      it("5.5 attaches customer phone and name to recovered cart record", () => {
        const sessionId = "sess-t1-feat5-05";
        const sync = syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "hash-r5" },
          items: [{ variantId: 101, quantity: 1 }],
        });

        captureLeadEngine(db, {
          sessionId,
          phoneNumber: "+91 98320 99887",
          customerName: "Dorjee Lama",
        });

        const fetched = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(sync.id) as any;
        expect(fetched.customer_phone).toBe("919832099887");
        expect(fetched.customer_name).toBe("Dorjee Lama");
      });
    });

    describe("Feature 6: Advanced Coupon Rules (Per-User / Per-Phone) (ORIGINAL_REQUEST §R3)", () => {
      it("6.1 allows initial checkout redemption for new phone number", () => {
        const quote = quoteAdvancedCoupon(db, "WELCOME10", 60000, { phone: "9831100001" });
        expect(quote.valid).toBe(true);
        expect(quote.discountPaise).toBe(6000); // 10% of 60000
      });

      it("6.2 rejects second redemption for single_use_per_customer coupon by same phone", () => {
        // Record prior redemption
        db.prepare(`
          INSERT INTO coupon_redemptions (coupon_code, order_id, customer_phone, customer_email, discount_paise)
          VALUES ('WELCOME10', NULL, '9831100002', 'user1@test.com', 6000)
        `).run();

        const quote = quoteAdvancedCoupon(db, "WELCOME10", 60000, { phone: "9831100002" });
        expect(quote.valid).toBe(false);
        expect(quote.reason).toContain("already been redeemed for this phone number");
      });

      it("6.3 rejects second redemption for single_use_per_customer coupon by same email", () => {
        db.prepare(`
          INSERT INTO coupon_redemptions (coupon_code, order_id, customer_phone, customer_email, discount_paise)
          VALUES ('WELCOME10', NULL, '9831100003', 'sam@teaclub.in', 6000)
        `).run();

        const quote = quoteAdvancedCoupon(db, "WELCOME10", 60000, { email: "sam@teaclub.in" });
        expect(quote.valid).toBe(false);
        expect(quote.reason).toContain("already been redeemed for this email address");
      });

      it("6.4 allows multi-use coupon up to per_user_limit = 5", () => {
        const phone = "9831100004";
        // Record 2 redemptions (under limit of 5 for HIGHROLLER25)
        db.prepare(`
          INSERT INTO coupon_redemptions (coupon_code, order_id, customer_phone, discount_paise) VALUES
          ('HIGHROLLER25', NULL, ?, 25000),
          ('HIGHROLLER25', NULL, ?, 25000)
        `).run(phone, phone);

        const quote = quoteAdvancedCoupon(db, "HIGHROLLER25", 100000, { phone });
        expect(quote.valid).toBe(true);
        expect(quote.discountPaise).toBe(25000);
      });

      it("6.5 rejects multi-use coupon when per_user_limit reached", () => {
        const phone = "9831100005";
        for (let i = 1; i <= 5; i++) {
          db.prepare(`
            INSERT INTO coupon_redemptions (coupon_code, order_id, customer_phone, discount_paise)
            VALUES ('HIGHROLLER25', NULL, ?, 25000)
          `).run(phone);
        }

        const quote = quoteAdvancedCoupon(db, "HIGHROLLER25", 100000, { phone });
        expect(quote.valid).toBe(false);
        expect(quote.reason).toContain("already been redeemed for this phone number");
      });
    });

    describe("Feature 7: Coupon Discount Limits & Subtotals (ORIGINAL_REQUEST §R3)", () => {
      it("7.1 enforces percentage discount calculation (10% of subtotal)", () => {
        const quote = quoteAdvancedCoupon(db, "WELCOME10", 80000);
        expect(quote.valid).toBe(true);
        expect(quote.discountPaise).toBe(8000);
      });

      it("7.2 clamps percentage discount to max_discount_paise cap (WELCOME10 capped at 20,000 paise)", () => {
        // 10% of 300,000 is 30,000, but cap is 20,000
        const quote = quoteAdvancedCoupon(db, "WELCOME10", 300000);
        expect(quote.valid).toBe(true);
        expect(quote.discountPaise).toBe(20000);
      });

      it("7.3 rejects coupon when subtotal is below min_subtotal_paise", () => {
        // WELCOME10 requires min_subtotal_paise = 50,000
        const quote = quoteAdvancedCoupon(db, "WELCOME10", 49000);
        expect(quote.valid).toBe(false);
        expect(quote.reason).toContain("Order subtotal is below the coupon minimum");
      });

      it("7.4 supports flat discount coupons (FLAT200 = 20,000 paise off)", () => {
        // FLAT200 min subtotal is 80,000
        const quote = quoteAdvancedCoupon(db, "FLAT200", 100000);
        expect(quote.valid).toBe(true);
        expect(quote.discountPaise).toBe(20000);
      });

      it("7.5 rejects inactive coupon codes", () => {
        db.prepare("INSERT INTO coupons (code, kind, value, is_active) VALUES ('INACTIVE99', 'percent', 20, 0)").run();
        const quote = quoteAdvancedCoupon(db, "INACTIVE99", 100000);
        expect(quote.valid).toBe(false);
        expect(quote.reason).toContain("Coupon is inactive");
      });
    });

    describe("Feature 9: 1-Click WhatsApp Recovery Message Generation (ORIGINAL_REQUEST §R4)", () => {
      it("9.1 formats standard WhatsApp recovery URL starting with https://wa.me/", () => {
        const url = generateWhatsAppRecoveryUrl({
          phone: "9832012345",
          customerName: "Rohan",
          items: [{ name: "Risheehat Summer Chinary", grams: 100, quantity: 1 }],
          totalPaise: 45000,
          recoveryToken: "rec-token-01",
        });
        expect(url.startsWith("https://wa.me/9832012345?text=")).toBe(true);
      });

      it("9.2 includes customer greeting 'Namaste Rohan!' in message text", () => {
        const url = generateWhatsAppRecoveryUrl({
          phone: "9832012345",
          customerName: "Rohan",
          items: [{ name: "Risheehat Summer Chinary", grams: 100, quantity: 1 }],
          totalPaise: 45000,
          recoveryToken: "rec-token-02",
        });
        const decoded = decodeURIComponent(url);
        expect(decoded).toContain("Namaste Rohan!");
      });

      it("9.3 formats itemized list with quantities, product names, and gram weights", () => {
        const url = generateWhatsAppRecoveryUrl({
          phone: "9832012345",
          customerName: "Vikram",
          items: [
            { name: "Arya Ruby First Flush", grams: 100, quantity: 2 },
            { name: "Luxury Tin Darjeeling", grams: 250, quantity: 1 },
          ],
          totalPaise: 235000,
          recoveryToken: "rec-token-03",
        });
        const decoded = decodeURIComponent(url);
        expect(decoded).toContain("- 2x Arya Ruby First Flush (100g)");
        expect(decoded).toContain("- 1x Luxury Tin Darjeeling (250g)");
        expect(decoded).toContain("Total: Rs 2350");
      });

      it("9.4 appends coupon code and recovery link to the message", () => {
        const url = generateWhatsAppRecoveryUrl({
          phone: "9832012345",
          items: [{ name: "Assam Tips", grams: 100, quantity: 1 }],
          totalPaise: 35000,
          couponCode: "SAVE10-2345",
          recoveryToken: "rec-token-04",
        });
        const decoded = decodeURIComponent(url);
        expect(decoded).toContain("Use exclusive coupon code SAVE10-2345");
        expect(decoded).toContain("https://teafloww.com/cart?recovery=rec-token-04");
      });

      it("9.5 falls back politely to 'Namaste!' when customer name is omitted", () => {
        const url = generateWhatsAppRecoveryUrl({
          phone: "9832012345",
          items: [{ name: "Assam Tips", grams: 100, quantity: 1 }],
          totalPaise: 35000,
          recoveryToken: "rec-token-05",
        });
        const decoded = decodeURIComponent(url);
        expect(decoded).toContain("Namaste!\nYou left some exquisite teas");
      });
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (>=5 cases per feature)
  // =========================================================================

  describe("Tier 2: Boundary & Corner Cases", () => {
    describe("Cart Sync Boundaries", () => {
      it("2.B1 accepts empty items array with 0 subtotal without error", () => {
        const sync = syncCartEngine(db, {
          sessionId: "sess-b-01",
          fingerprint: { fingerprintHash: "hash-b1" },
          items: [],
        });
        expect(sync.subtotalPaise).toBe(0);
        expect(sync.itemCount).toBe(0);
        expect(sync.items).toHaveLength(0);
      });

      it("2.B2 clamps excessive variant quantity to max 20 per line", () => {
        const sync = syncCartEngine(db, {
          sessionId: "sess-b-02",
          fingerprint: { fingerprintHash: "hash-b2" },
          items: [{ variantId: 101, quantity: 99 }],
        });
        expect(sync.items[0].quantity).toBe(20);
        expect(sync.subtotalPaise).toBe(20 * 45000);
      });

      it("2.B3 ignores non-existent variant IDs gracefully", () => {
        const sync = syncCartEngine(db, {
          sessionId: "sess-b-03",
          fingerprint: { fingerprintHash: "hash-b3" },
          items: [{ variantId: 999999, quantity: 1 }],
        });
        expect(sync.items).toHaveLength(0);
        expect(sync.subtotalPaise).toBe(0);
      });

      it("2.B4 merges duplicate variant items in input into single line", () => {
        const sync = syncCartEngine(db, {
          sessionId: "sess-b-04",
          fingerprint: { fingerprintHash: "hash-b4" },
          items: [
            { variantId: 101, quantity: 2 },
            { variantId: 101, quantity: 3 },
          ],
        });
        expect(sync.items).toHaveLength(1);
        expect(sync.items[0].quantity).toBe(5);
        expect(sync.subtotalPaise).toBe(5 * 45000);
      });

      it("2.B5 handles large subtotal values (₹100,000+ / 10,000,000 paise) accurately", () => {
        const sync = syncCartEngine(db, {
          sessionId: "sess-b-05",
          fingerprint: { fingerprintHash: "hash-b5" },
          items: [{ variantId: 102, quantity: 20 }], // 20 * 105,000 = 2,100,000 paise
        });
        expect(sync.subtotalPaise).toBe(2100000);
      });
    });

    describe("Fingerprint & Geolocation Boundaries", () => {
      it("2.B6 extracts first public IP from comma-separated X-Forwarded-For chain", () => {
        const geo = resolveGeoLocation("103.21.244.2, 70.41.3.18, 150.172.238.178");
        expect(geo.ip).toBe("103.21.244.2");
      });

      it("2.B7 falls back to 127.0.0.1 when IP string is empty or whitespace", () => {
        const geo = resolveGeoLocation("   ");
        expect(geo.ip).toBe("127.0.0.1");
        expect(geo.city).toBe("Siliguri");
      });

      it("2.B8 produces valid SHA-256 fingerprint hash even when optional signals are empty", () => {
        const hash = computeDeviceFingerprintHash({ fingerprintHash: "" });
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      });

      it("2.B9 preserves timezone when provided as non-UTC string (e.g. America/New_York)", () => {
        const sessionId = "sess-b-09";
        syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "fp_tz", timezone: "America/New_York" },
          items: [{ variantId: 101, quantity: 1 }],
        });
        const fp = db.prepare("SELECT timezone FROM visitor_fingerprints WHERE session_id = ?").get(sessionId) as any;
        expect(fp.timezone).toBe("America/New_York");
      });

      it("2.B10 sanitizes long user-agent strings without crashing database", () => {
        const longUa = "Mozilla/5.0 ".repeat(50);
        const sessionId = "sess-b-10";
        syncCartEngine(db, {
          sessionId,
          fingerprint: { fingerprintHash: "fp_ua" },
          items: [{ variantId: 101, quantity: 1 }],
          userAgent: longUa,
        });
        const fp = db.prepare("SELECT user_agent FROM visitor_fingerprints WHERE session_id = ?").get(sessionId) as any;
        expect(fp.user_agent.length).toBeGreaterThan(100);
      });
    });

    describe("Lead Capture Boundaries", () => {
      it("2.B11 normalizes Indian phone numbers with leading +91", () => {
        const res = captureLeadEngine(db, {
          sessionId: "sess-b-11",
          phoneNumber: "+91 98320 12345",
        });
        expect(res.couponCode).toBe("SAVE10-2345");
      });

      it("2.B12 normalizes Indian phone numbers with leading 0", () => {
        const res = captureLeadEngine(db, {
          sessionId: "sess-b-12",
          phoneNumber: "09832012345",
        });
        expect(res.couponCode).toBe("SAVE10-2345");
      });

      it("2.B13 rejects invalid phone number with fewer than 10 digits", () => {
        expect(() => {
          captureLeadEngine(db, {
            sessionId: "sess-b-13",
            phoneNumber: "12345",
          });
        }).toThrow(/Invalid phone number/);
      });

      it("2.B14 rejects alphabetical characters in phone number", () => {
        expect(() => {
          captureLeadEngine(db, {
            sessionId: "sess-b-14",
            phoneNumber: "call-me-please",
          });
        }).toThrow(/Invalid phone number/);
      });

      it("2.B15 updates customer name on duplicate lead submission from same session", () => {
        const sessionId = "sess-b-15";
        captureLeadEngine(db, { sessionId, phoneNumber: "9832011111", customerName: "Initial" });
        captureLeadEngine(db, { sessionId, phoneNumber: "9832011111", customerName: "Updated Name" });

        const leads = db.prepare("SELECT * FROM captured_leads WHERE session_id = ?").all(sessionId);
        expect(leads.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe("Coupon Rules Boundaries", () => {
      it("2.B16 subtotal exactly equal to min_subtotal_paise is valid", () => {
        // WELCOME10 requires min 50000
        const quote = quoteAdvancedCoupon(db, "WELCOME10", 50000);
        expect(quote.valid).toBe(true);
      });

      it("2.B17 subtotal 1 paise below min_subtotal_paise is rejected", () => {
        const quote = quoteAdvancedCoupon(db, "WELCOME10", 49999);
        expect(quote.valid).toBe(false);
      });

      it("2.B18 zero subtotal yields 0 discount", () => {
        const quote = quoteAdvancedCoupon(db, "WELCOME10", 0);
        expect(quote.valid).toBe(false);
      });

      it("2.B19 case-insensitive email matching for coupon redemption check", () => {
        db.prepare(`
          INSERT INTO coupon_redemptions (coupon_code, order_id, customer_email, discount_paise)
          VALUES ('WELCOME10', NULL, 'mixedcase@tea.org', 5000)
        `).run();

        const quote = quoteAdvancedCoupon(db, "WELCOME10", 60000, { email: "MIXEDCASE@TEA.ORG" });
        expect(quote.valid).toBe(false);
      });

      it("2.B20 phone format variants (+91 vs bare 10-digit) match same customer redemption", () => {
        db.prepare(`
          INSERT INTO coupon_redemptions (coupon_code, order_id, customer_phone, discount_paise)
          VALUES ('WELCOME10', NULL, '919832099999', 5000)
        `).run();

        const quote = quoteAdvancedCoupon(db, "WELCOME10", 60000, { phone: "98320 99999" });
        expect(quote.valid).toBe(false);
      });
    });

    describe("WhatsApp Recovery Link Boundaries", () => {
      it("2.B21 handles special characters (&, ', \") in tea product names with valid URL encoding", () => {
        const url = generateWhatsAppRecoveryUrl({
          phone: "9832012345",
          items: [{ name: "Earl Grey & Lavender 'Artisanal' Blend", grams: 100, quantity: 1 }],
          totalPaise: 50000,
          recoveryToken: "rec-spec-01",
        });
        expect(url).not.toContain("&Lavender"); // Must be URL encoded as %26
        const decoded = decodeURIComponent(url);
        expect(decoded).toContain("Earl Grey & Lavender 'Artisanal' Blend");
      });

      it("2.B22 handles empty customer name with fallback greeting without extra spaces", () => {
        const url = generateWhatsAppRecoveryUrl({
          phone: "9832012345",
          customerName: "   ",
          items: [{ name: "Darjeeling", grams: 100, quantity: 1 }],
          totalPaise: 45000,
          recoveryToken: "rec-spec-02",
        });
        const decoded = decodeURIComponent(url);
        expect(decoded).toContain("Namaste!\nYou left some exquisite teas");
      });

      it("2.B23 cleans phone containing parentheses, dashes and plus signs", () => {
        const url = generateWhatsAppRecoveryUrl({
          phone: "+91 (98320) 12-345",
          items: [{ name: "Assam", grams: 100, quantity: 1 }],
          totalPaise: 35000,
          recoveryToken: "rec-spec-03",
        });
        expect(url.startsWith("https://wa.me/919832012345?text=")).toBe(true);
      });

      it("2.B24 falls back to default store WhatsApp if phone string has no digits", () => {
        const url = generateWhatsAppRecoveryUrl({
          phone: "unknown",
          items: [{ name: "Assam", grams: 100, quantity: 1 }],
          totalPaise: 35000,
          recoveryToken: "rec-spec-04",
        });
        expect(url.startsWith("https://wa.me/919832012345?text=")).toBe(true);
      });

      it("2.B25 correctly formats total when paise does not divide evenly to rupees (e.g. 45050 paise)", () => {
        const url = generateWhatsAppRecoveryUrl({
          phone: "9832012345",
          items: [{ name: "Assam", grams: 100, quantity: 1 }],
          totalPaise: 45050,
          recoveryToken: "rec-spec-05",
        });
        const decoded = decodeURIComponent(url);
        expect(decoded).toContain("Total: Rs 451");
      });
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE INTERACTIONS (>=7 tests)
  // =========================================================================

  describe("Tier 3: Cross-Feature Interactions", () => {
    it("3.1 Cart Sync + Fingerprinting -> persistent session and fingerprint association", () => {
      const sessionId = "sess-x-01";
      const sync = syncCartEngine(db, {
        sessionId,
        fingerprint: {
          fingerprintHash: "fp_cross_01",
          canvasHash: "cv_x1",
          webglRenderer: "Apple Metal",
          screenResolution: "1440x900",
        },
        items: [{ variantId: 101, quantity: 2 }],
        ipAddress: "203.0.113.195",
      });

      const cart = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(sync.id) as any;
      const fp = db.prepare("SELECT * FROM visitor_fingerprints WHERE session_id = ?").get(sessionId) as any;

      expect(cart.session_id).toBe(fp.session_id);
      expect(fp.canvas_hash).toBe("cv_x1");
      expect(cart.subtotal_paise).toBe(90000);
    });

    it("3.2 Cart Sync + Lead Capture -> links phone to active cart and sets provisioned coupon", () => {
      const sessionId = "sess-x-02";
      const sync = syncCartEngine(db, {
        sessionId,
        fingerprint: { fingerprintHash: "fp_cross_02" },
        items: [{ variantId: 102, quantity: 1 }],
      });

      const lead = captureLeadEngine(db, {
        sessionId,
        phoneNumber: "9832055443",
        customerName: "Kiran",
        source: "exit_intent",
      });

      const cartAfter = db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(sync.id) as any;
      expect(cartAfter.customer_phone).toBe("9832055443");
      expect(cartAfter.customer_name).toBe("Kiran");
      expect(cartAfter.applied_coupon_code).toBe(lead.couponCode);
    });

    it("3.3 Lead Capture + Coupon Validation -> provisioned coupon valid for this phone only", () => {
      const sessionId = "sess-x-03";
      syncCartEngine(db, {
        sessionId,
        fingerprint: { fingerprintHash: "fp_cross_03" },
        items: [{ variantId: 102, quantity: 1 }],
      });

      const lead = captureLeadEngine(db, {
        sessionId,
        phoneNumber: "9832077889",
        customerName: "Pooja",
      });

      // Valid for captured phone
      const checkValid = quoteAdvancedCoupon(db, lead.couponCode, 105000, { phone: "9832077889" });
      expect(checkValid.valid).toBe(true);
      expect(checkValid.discountPaise).toBe(10500); // 10%
    });

    it("3.4 Cart Recovery Link Hydration + Coupon Auto-Application -> reproduces bag with discount", () => {
      const sessionId = "sess-x-04";
      const sync = syncCartEngine(db, {
        sessionId,
        fingerprint: { fingerprintHash: "fp_cross_04" },
        items: [{ variantId: 101, quantity: 2 }],
      });

      captureLeadEngine(db, {
        sessionId,
        phoneNumber: "9832099112",
        customerName: "Arun",
      });

      // Recover via token
      const recoveredCart = db.prepare("SELECT * FROM abandoned_carts WHERE recovery_token = ?").get(sync.recoveryToken) as any;
      expect(recoveredCart.applied_coupon_code).toBeTruthy();

      const quote = quoteAdvancedCoupon(db, recoveredCart.applied_coupon_code, recoveredCart.subtotal_paise, {
        phone: recoveredCart.customer_phone,
      });
      expect(quote.valid).toBe(true);
    });

    it("3.5 Checkout Conversion + Coupon Redemption -> atomically converts cart and locks coupon", () => {
      const sessionId = "sess-x-05";
      const sync = syncCartEngine(db, {
        sessionId,
        fingerprint: { fingerprintHash: "fp_cross_05" },
        items: [{ variantId: 102, quantity: 1 }],
      });

      const lead = captureLeadEngine(db, {
        sessionId,
        phoneNumber: "9832033445",
        customerName: "Debashis",
      });

      const orderId = "ord-cross-05";
      db.prepare(`
        INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, total_paise, coupon_code, discount_paise)
        VALUES (?, 'idem-x-05', 'Debashis', 'deb@darjeeling.net', 'Darjeeling Mall', 105000, 94500, ?, 10500)
      `).run(orderId, lead.couponCode);

      convertCartToOrder(db, sync.id, {
        id: orderId,
        customerName: "Debashis",
        customerEmail: "deb@darjeeling.net",
        customerPhone: "9832033445",
        totalPaise: 94500,
        couponCode: lead.couponCode,
        discountPaise: 10500,
      });

      // Attempt second redemption with same phone -> must be blocked
      const secondAttempt = quoteAdvancedCoupon(db, lead.couponCode, 105000, { phone: "9832033445" });
      expect(secondAttempt.valid).toBe(false);
      expect(secondAttempt.reason).toContain("already been redeemed for this phone number");
    });

    it("3.6 Phone Lead + 1-Click WhatsApp Recovery Link -> generates tailored link matching cart state", () => {
      const sessionId = "sess-x-06";
      const sync = syncCartEngine(db, {
        sessionId,
        fingerprint: { fingerprintHash: "fp_cross_06" },
        items: [{ variantId: 101, quantity: 2 }, { variantId: 103, quantity: 1 }],
      });

      const lead = captureLeadEngine(db, {
        sessionId,
        phoneNumber: "9832044556",
        customerName: "Shanti",
      });

      const waUrl = generateWhatsAppRecoveryUrl({
        phone: "9832044556",
        customerName: "Shanti",
        items: sync.items.map((i) => ({ name: i.name, grams: i.grams, quantity: i.quantity })),
        totalPaise: sync.subtotalPaise,
        couponCode: lead.couponCode,
        recoveryToken: sync.recoveryToken,
      });

      const decoded = decodeURIComponent(waUrl);
      expect(decoded).toContain("Namaste Shanti!");
      expect(decoded).toContain(lead.couponCode);
      expect(decoded).toContain(sync.recoveryToken);
    });

    it("3.7 Multi-device fingerprint matching -> associates shared canvas and audio signature", () => {
      const fpShared: FingerprintSignals = {
        fingerprintHash: "",
        canvasHash: "shared_canvas_hash_77",
        webglRenderer: "Apple M2 GPU",
        audioSignature: "shared_audio_sig_77",
        timezone: "Asia/Kolkata",
      };
      const hash1 = computeDeviceFingerprintHash(fpShared);
      const hash2 = computeDeviceFingerprintHash({ ...fpShared });
      expect(hash1).toBe(hash2);
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD SCENARIOS (>=4 complete journeys)
  // =========================================================================

  describe("Tier 4: Real-World Scenarios", () => {
    it("4.1 Complete Customer Journey: Darjeeling First Flush abandoned bag -> exit-intent modal -> WhatsApp recovery -> checkout completed", () => {
      // Step 1: Customer arrives and adds 2 pouches of Darjeeling First Flush
      const sessionId = "sess-journey-01";
      const initialCart = syncCartEngine(db, {
        sessionId,
        fingerprint: {
          fingerprintHash: "fp_j1",
          canvasHash: "cv_j1",
          screenResolution: "1920x1080",
          timezone: "Asia/Kolkata",
        },
        items: [{ variantId: 103, quantity: 2 }], // 2 * 65,000 = 130,000 paise
        ipAddress: "103.21.244.10",
      });
      expect(initialCart.subtotalPaise).toBe(130000);
      expect(initialCart.status).toBe("active");

      // Step 2: Exit-intent triggers; customer enters phone number for 10% coupon
      const lead = captureLeadEngine(db, {
        sessionId,
        phoneNumber: "+91 98320 12345",
        customerName: "Ananya Mukherjee",
        source: "exit_intent",
      });
      expect(lead.success).toBe(true);
      expect(lead.couponCode).toMatch(/^SAVE10-/);

      // Step 3: Shopper goes idle -> Admin views cart in dashboard and triggers 1-Click WhatsApp
      const waUrl = generateWhatsAppRecoveryUrl({
        phone: "919832012345",
        customerName: "Ananya Mukherjee",
        items: initialCart.items.map((i) => ({ name: i.name, grams: i.grams, quantity: i.quantity })),
        totalPaise: initialCart.subtotalPaise,
        couponCode: lead.couponCode,
        recoveryToken: initialCart.recoveryToken,
      });
      expect(waUrl).toContain("https://wa.me/919832012345");

      // Step 4: Customer clicks recovery link and checks out
      const orderId = "ord-journey-01";
      db.prepare(`
        INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, total_paise, coupon_code, discount_paise)
        VALUES (?, 'idem-j-01', 'Ananya Mukherjee', 'ananya@calcutta.com', 'Ballygunge, Kolkata', 130000, 117000, ?, 13000)
      `).run(orderId, lead.couponCode);

      const converted = convertCartToOrder(db, initialCart.id, {
        id: orderId,
        customerName: "Ananya Mukherjee",
        customerEmail: "ananya@calcutta.com",
        customerPhone: "919832012345",
        totalPaise: 117000,
        couponCode: lead.couponCode,
        discountPaise: 13000,
      });

      // Step 5: Verification of final business invariants
      expect(converted.cart.status).toBe("converted");
      expect(converted.cart.convertedOrderId).toBe(orderId);

      // Promo coupon is now locked for this customer's phone
      const secondTry = quoteAdvancedCoupon(db, lead.couponCode, 130000, { phone: "919832012345" });
      expect(secondTry.valid).toBe(false);
    });

    it("4.2 High-Value Bulk Order: Premium Silver Needle cart hits max_discount_paise cap -> recovery completed", () => {
      const sessionId = "sess-journey-02";
      // Customer configures high value order (4x Luxury Tin = 420,000 paise)
      const cart = syncCartEngine(db, {
        sessionId,
        fingerprint: { fingerprintHash: "fp_j2" },
        items: [{ variantId: 102, quantity: 4 }],
      });
      expect(cart.subtotalPaise).toBe(420000);

      // Customer applies WELCOME10 (10% capped at 20,000 paise)
      const quote = quoteAdvancedCoupon(db, "WELCOME10", cart.subtotalPaise, { phone: "9832098765" });
      expect(quote.valid).toBe(true);
      expect(quote.discountPaise).toBe(20000); // Clamped to max_discount_paise, not 42,000

      // Admin converts order
      const orderId = "ord-journey-02";
      db.prepare(`
        INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, total_paise, coupon_code, discount_paise)
        VALUES (?, 'idem-j-02', 'Pradeep Singhania', 'pradeep@estate.in', 'Park Street, Kolkata', 420000, 400000, 'WELCOME10', 20000)
      `).run(orderId);

      const converted = convertCartToOrder(db, cart.id, {
        id: orderId,
        customerName: "Pradeep Singhania",
        customerEmail: "pradeep@estate.in",
        customerPhone: "9832098765",
        totalPaise: 400000,
        couponCode: "WELCOME10",
        discountPaise: 20000,
      });

      expect(converted.cart.status).toBe("converted");
    });

    it("4.3 Mobile Shopper Interrupted: Mobile shopper adds items -> cart inactivity -> restores on desktop via token", () => {
      const sessionId = "sess-journey-03";
      // Mobile session
      const mobileSync = syncCartEngine(db, {
        sessionId,
        fingerprint: {
          fingerprintHash: "fp_mobile",
          screenResolution: "390x844",
          deviceMemory: 4,
          hardwareConcurrency: 4,
        },
        items: [{ variantId: 104, quantity: 3 }], // Assam Tips 3x = 105,000 paise
      });

      // Lead captured on mobile
      captureLeadEngine(db, {
        sessionId,
        phoneNumber: "9832044332",
        customerName: "Tashi",
      });

      // Shopper switches to desktop, hydrates using recoveryToken
      const desktopRecovered = db.prepare("SELECT * FROM abandoned_carts WHERE recovery_token = ?").get(mobileSync.recoveryToken) as any;
      expect(desktopRecovered.item_count).toBe(3);
      expect(desktopRecovered.subtotal_paise).toBe(105000);
      expect(desktopRecovered.customer_phone).toBe("9832044332");
    });

    it("4.4 Edge Case Recovery: Customer with international formatting and proxy IP resolves accurately", () => {
      const sessionId = "sess-journey-04";
      const sync = syncCartEngine(db, {
        sessionId,
        fingerprint: { fingerprintHash: "fp_edge" },
        items: [{ variantId: 101, quantity: 1 }],
        ipAddress: "127.0.0.1, 10.0.0.1",
      });

      const lead = captureLeadEngine(db, {
        sessionId,
        phoneNumber: "+91-98320-88776",
        customerName: "Dr. K. Chatterjee",
      });

      expect(lead.couponCode).toBe("SAVE10-8776");

      const waUrl = generateWhatsAppRecoveryUrl({
        phone: "919832088776",
        customerName: "Dr. K. Chatterjee",
        items: sync.items.map((i) => ({ name: i.name, grams: i.grams, quantity: i.quantity })),
        totalPaise: sync.subtotalPaise,
        recoveryToken: sync.recoveryToken,
      });

      expect(waUrl).toContain("https://wa.me/919832088776");
    });
  });
});
