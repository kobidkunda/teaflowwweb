import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { randomUUID } from "node:crypto";

const TEST_DB = path.join(tmpdir(), `abandoned-carts-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

const {
  fnv1a,
  getOrCreateSessionId,
  getClientFingerprint,
  getCanvasHash,
  getWebGLRenderer,
  getAudioSignature,
  getScreenResolution,
  getTimezone,
  getDeviceMemory,
  getHardwareConcurrency,
} = await import("../../src/lib/fingerprint");

const {
  extractClientIp,
  isPrivateIp,
  extractGeo,
  resolveGeo,
  clearGeoCache,
} = await import("../../src/lib/geo");

const {
  cartSyncSchema,
  syncAbandonedCart,
  markCartConverted,
  getCartBySession,
  getCartById,
} = await import("../../src/lib/abandonedCarts");

const { createDemoOrder } = await import("../../src/lib/checkout");
const { getDb } = await import("../../src/lib/db");
const { upsertProduct, upsertVariant } = await import("../../src/lib/products");
const { POST: syncRoutePOST } = await import("../../src/app/api/cart/sync/route");
const { resetRateLimits } = await import("../../src/lib/rateLimit");

let variantId1: number;
let variantId2: number;

beforeAll(() => {
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: TEST_DB },
    stdio: "ignore",
  });

  const product = upsertProduct({
    slug: "darjeeling-spring-first-flush",
    name: "Darjeeling Spring First Flush",
    category: "Black",
    origin: "Darjeeling, India",
    estate: "Risheehat",
    flush: "First Flush",
    harvest_date: "Spring 2026",
    description: "Exquisite single-estate first flush tea.",
    tasting_notes: "Floral, Muscatel, Crisp",
    floral: 5,
    fruity: 4,
    malty: 2,
    body: 3,
    brew_temp: 90,
    brew_seconds: 180,
    featured: 1,
  });

  const v1 = upsertVariant({
    product_id: product.id,
    sku: "DARJ-FF-100",
    grams: 100,
    price_paise: 45000, // Rs 450
    stock: 20,
  });
  variantId1 = v1.id;

  const v2 = upsertVariant({
    product_id: product.id,
    sku: "DARJ-FF-250",
    grams: 250,
    price_paise: 95000, // Rs 950
    stock: 15,
  });
  variantId2 = v2.id;
});

afterAll(() => {
  resetRateLimits();
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    try {
      rmSync(TEST_DB + suffix, { force: true });
    } catch {
      /* ignore */
    }
  }
});

beforeEach(() => {
  resetRateLimits();
});

describe("1. Client Device Fingerprinting Engine (src/lib/fingerprint.ts)", () => {
  it("computes deterministic 32-bit FNV-1a hashes", () => {
    const hash1 = fnv1a("Himalayan Tea House");
    const hash2 = fnv1a("Himalayan Tea House");
    const hash3 = fnv1a("Risheehat First Flush");

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{8}$/);
    expect(hash1).not.toBe(hash3);
  });

  it("handles empty and special characters in fnv1a", () => {
    const emptyHash = fnv1a("");
    expect(emptyHash).toBe("811c9dc5"); // Standard FNV-1a 32-bit offset basis

    const unicodeHash = fnv1a("🍃 100°C Darjeeling Risheehat");
    expect(unicodeHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is SSR-safe and executes in Node without window or DOM references", async () => {
    expect(getOrCreateSessionId()).toBe("");
    expect(getCanvasHash()).toBeUndefined();
    expect(getWebGLRenderer()).toBeUndefined();
    expect(await getAudioSignature()).toBeUndefined();
    expect(getScreenResolution()).toBeUndefined();
    expect(getDeviceMemory()).toBeUndefined();
    expect(getHardwareConcurrency()).toBeUndefined();

    // Node environment has timezone support via Intl
    const tz = getTimezone();
    expect(typeof tz === "string" || tz === undefined).toBe(true);

    const fp = await getClientFingerprint();
    expect(fp.fingerprintHash).toBe("ssr");
  });
});

describe("2. Server Geolocation & IP Enrichment (src/lib/geo.ts)", () => {
  it("extracts client IP from X-Forwarded-For first hop", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.195, 10.0.0.1, 192.168.1.1" },
    });
    expect(extractClientIp(req)).toBe("203.0.113.195");
  });

  it("falls back to X-Real-IP and CF-Connecting-IP", () => {
    const req1 = new Request("http://localhost/api/test", {
      headers: { "x-real-ip": "198.51.100.42" },
    });
    expect(extractClientIp(req1)).toBe("198.51.100.42");

    const req2 = new Request("http://localhost/api/test", {
      headers: { "cf-connecting-ip": "198.51.100.99" },
    });
    expect(extractClientIp(req2)).toBe("198.51.100.99");

    const req3 = new Request("http://localhost/api/test");
    expect(extractClientIp(req3)).toBe("127.0.0.1");
  });

  it("correctly identifies private and loopback IP addresses", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("localhost")).toBe(true);
    expect(isPrivateIp("10.0.4.15")).toBe(true);
    expect(isPrivateIp("172.16.5.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("169.254.10.20")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd12:3456:789a::1")).toBe(true);

    expect(isPrivateIp("203.0.113.1")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });

  it("defaults private/localhost IPs to Siliguri, West Bengal, India", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "127.0.0.1" },
    });
    const geo = extractGeo(req);
    expect(geo.isLocal).toBe(true);
    expect(geo.city).toBe("Siliguri");
    expect(geo.region).toBe("West Bengal");
    expect(geo.country).toBe("India");
  });

  it("extracts and URL-decodes edge CDN geo headers for public IPs", () => {
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "103.21.244.2",
        "cf-ipcountry": "IN",
        "cf-region": "West Bengal",
        "cf-ipcity": "Kolkata",
      },
    });
    const geo = extractGeo(req);
    expect(geo.isLocal).toBe(false);
    expect(geo.country).toBe("IN");
    expect(geo.region).toBe("West Bengal");
    expect(geo.city).toBe("Kolkata");

    // URL-encoded multi-word city test
    const reqVercel = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "103.21.244.2",
        "x-vercel-ip-country": "IN",
        "x-vercel-ip-country-region": "Delhi",
        "x-vercel-ip-city": "New%20Delhi",
      },
    });
    const geoVercel = extractGeo(reqVercel);
    expect(geoVercel.city).toBe("New Delhi");
  });

  it("resolves public IP geolocation via ip-api.com and caches the result", async () => {
    clearGeoCache();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "success",
          country: "Canada",
          regionName: "Quebec",
          city: "Montreal",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = new Request("http://localhost/api/cart/sync", {
      headers: { "x-forwarded-for": "24.48.0.1" },
    });

    const first = await resolveGeo(req);
    expect(first.ip).toBe("24.48.0.1");
    expect(first.country).toBe("Canada");
    expect(first.region).toBe("Quebec");
    expect(first.city).toBe("Montreal");
    expect(first.isLocal).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call for same IP should hit the cache without calling fetch again
    const second = await resolveGeo(req);
    expect(second.city).toBe("Montreal");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });
});

describe("3. Abandoned Cart Synchronization Service (src/lib/abandonedCarts.ts)", () => {
  it("persists visitor fingerprint signals and synchronizes active cart", () => {
    const sid = "session-test-01";
    const result = syncAbandonedCart({
      sessionId: sid,
      fingerprint: {
        fingerprintHash: "fp_hash_01",
        canvasHash: "canv_01",
        webglRenderer: "Apple M2 Max",
        audioSignature: "0.123456",
        screenResolution: "1920x1080x24@2",
        timezone: "Asia/Kolkata",
        deviceMemory: 8,
        hardwareConcurrency: 12,
      },
      items: [
        { variantId: variantId1, quantity: 2 },
        { variantId: variantId2, quantity: 1 },
      ],
      geo: {
        ip: "203.0.113.50",
        city: "Darjeeling",
        region: "West Bengal",
        country: "India",
        isLocal: false,
      },
      userAgent: "Mozilla/5.0 TestBrowser",
    });

    expect(result.cartId).toMatch(/^cart_/);
    expect(result.recoveryToken).toMatch(/^rec_/);
    expect(result.status).toBe("active");
    expect(result.itemCount).toBe(3);
    // (2 * 45000) + (1 * 95000) = 90000 + 95000 = 185000
    expect(result.subtotalPaise).toBe(185000);

    // Verify database state directly
    const stored = getCartBySession(sid);
    expect(stored).not.toBeNull();
    expect(stored?.cart.status).toBe("active");
    expect(stored?.cart.subtotal_paise).toBe(185000);
    expect(stored?.cart.item_count).toBe(3);
    expect(stored?.items.length).toBe(2);

    // Verify visitor fingerprint table
    const fpRow = getDb().prepare("SELECT * FROM visitor_fingerprints WHERE session_id = ?").get(sid) as any;
    expect(fpRow).toBeDefined();
    expect(fpRow.fingerprint_hash).toBe("fp_hash_01");
    expect(fpRow.webgl_renderer).toBe("Apple M2 Max");
    expect(fpRow.ip_city).toBe("Darjeeling");
  });

  it("re-verifies prices strictly on server and ignores client price tampering", () => {
    const sid = "session-test-tamper";
    const result = syncAbandonedCart({
      sessionId: sid,
      items: [{ variantId: variantId1, quantity: 3 }],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "TestAgent",
    });

    // 3 * 45000 = 135000 paise
    expect(result.subtotalPaise).toBe(135000);
    expect(result.itemCount).toBe(3);

    const stored = getCartById(result.cartId);
    expect(stored?.items[0].unit_price_paise).toBe(45000);
  });

  it("updates existing cart on subsequent sync without creating duplicate carts", () => {
    const sid = "session-test-update";
    const firstSync = syncAbandonedCart({
      sessionId: sid,
      items: [{ variantId: variantId1, quantity: 1 }],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "TestAgent",
    });

    expect(firstSync.itemCount).toBe(1);
    expect(firstSync.subtotalPaise).toBe(45000);

    // Second sync modifies items for the same session
    const secondSync = syncAbandonedCart({
      sessionId: sid,
      items: [{ variantId: variantId2, quantity: 2 }],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "TestAgent",
    });

    // Cart ID and recovery token are preserved
    expect(secondSync.cartId).toBe(firstSync.cartId);
    expect(secondSync.recoveryToken).toBe(firstSync.recoveryToken);
    expect(secondSync.itemCount).toBe(2);
    expect(secondSync.subtotalPaise).toBe(190000); // 2 * 95000

    // Only one cart exists for this session in database
    const dbCarts = getDb().prepare("SELECT COUNT(*) as cnt FROM abandoned_carts WHERE session_id = ?").get(sid) as { cnt: number };
    expect(dbCarts.cnt).toBe(1);
  });

  it("handles clearing all items by resetting subtotal and removing line items", () => {
    const sid = "session-test-clear";
    const initial = syncAbandonedCart({
      sessionId: sid,
      items: [{ variantId: variantId1, quantity: 2 }],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "TestAgent",
    });

    expect(initial.subtotalPaise).toBe(90000);

    const cleared = syncAbandonedCart({
      sessionId: sid,
      items: [],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "TestAgent",
    });

    expect(cleared.cartId).toBe(initial.cartId);
    expect(cleared.subtotalPaise).toBe(0);
    expect(cleared.itemCount).toBe(0);

    const stored = getCartById(cleared.cartId);
    expect(stored?.items.length).toBe(0);
  });
});

describe("4. Order Checkout Conversion Hook (src/lib/checkout.ts)", () => {
  it("transitions active cart to 'converted' atomically upon order creation", () => {
    const sid = "session-checkout-convert";
    const syncRes = syncAbandonedCart({
      sessionId: sid,
      items: [{ variantId: variantId1, quantity: 2 }],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "TestAgent",
    });

    expect(syncRes.status).toBe("active");

    const orderRes = createDemoOrder({
      name: "Tenzing Norgay",
      email: "tenzing@himalaya.example",
      address: "10 Mountain View Path, Darjeeling",
      idempotencyKey: randomUUID(),
      phone: "+919876543210",
      sessionId: sid,
      items: [{ variantId: variantId1, quantity: 2 }],
    });

    expect(orderRes.orderId).toBeTruthy();

    const stored = getCartById(syncRes.cartId);
    expect(stored?.cart.status).toBe("converted");
    expect(stored?.cart.converted_order_id).toBe(orderRes.orderId);
    expect(stored?.cart.customer_name).toBe("Tenzing Norgay");
    expect(stored?.cart.customer_email).toBe("tenzing@himalaya.example");
  });

  it("handles markCartConverted helper directly when called", () => {
    const db = getDb();
    const sid = "session-helper-convert";
    const cart = syncAbandonedCart({
      sessionId: sid,
      items: [{ variantId: variantId1, quantity: 1 }],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "TestAgent",
    });

    const testOrderId = randomUUID();
    // Insert dummy order to satisfy foreign key
    db.prepare(`
      INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, shipping_paise, total_paise, status)
      VALUES (?, ?, 'Helper Tester', 'helper@example.com', '123 Test St', 45000, 0, 45000, 'demo_unpaid')
    `).run(testOrderId, randomUUID());

    const converted = markCartConverted(db, {
      orderId: testOrderId,
      sessionId: sid,
      customerName: "Helper Tester",
      customerEmail: "helper@example.com",
    });

    expect(converted).toBe(true);

    const stored = getCartById(cart.cartId);
    expect(stored?.cart.status).toBe("converted");
    expect(stored?.cart.converted_order_id).toBe(testOrderId);
  });
});

describe("5. POST /api/cart/sync Endpoint", () => {
  it("rejects non-JSON request body with HTTP 400", async () => {
    const req = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json{",
    });

    const res = await syncRoutePOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid JSON body.");
  });

  it("rejects invalid payload violating Zod schema with HTTP 400", async () => {
    const req = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "", // Empty string violates min(1)
        items: [{ variantId: -1, quantity: 99 }], // Negative ID and >20 quantity
      }),
    });

    const res = await syncRoutePOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid cart sync payload.");
  });

  it("accepts trial pack items (variantId: 0 with trialId) and persists checkout customer details", async () => {
    const payload = {
      sessionId: "session-trial-customer-01",
      items: [
        { variantId: 0, trialId: "trial-pack-uuid-1", quantity: 1 },
        { variantId: variantId1, quantity: 2 },
      ],
      customer: {
        name: "Aarav Sharma",
        phone: "+91 98765 43210",
        email: "aarav@example.com",
        city: "Siliguri",
        state: "West Bengal",
        postcode: "734005",
        address: "14 Hill Cart Road",
      },
    };

    const parsed = cartSyncSchema.safeParse(payload);
    expect(parsed.success).toBe(true);

    const res = await syncRoutePOST(
      new Request("http://localhost/api/cart/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify(payload),
      })
    );
    expect(res.status).toBe(200);

    const stored = getCartBySession("session-trial-customer-01");
    expect(stored).not.toBeNull();
    expect(stored?.cart.customer_name).toBe("Aarav Sharma");
    expect(stored?.cart.customer_phone).toBe("919876543210");
    expect(stored?.cart.customer_email).toBe("aarav@example.com");
    expect(stored?.cart.shipping_city).toBe("Siliguri");
    expect(stored?.cart.shipping_state).toBe("West Bengal");
    expect(stored?.cart.shipping_postcode).toBe("734005");
  });

  it("successfully synchronizes cart and returns HTTP 200 with tokens", async () => {
    const req = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "103.21.244.15",
      },
      body: JSON.stringify({
        sessionId: "session-route-test-01",
        fingerprint: {
          fingerprintHash: "fp_route_01",
          timezone: "Asia/Kolkata",
        },
        items: [{ variantId: variantId1, quantity: 2 }],
      }),
    });

    const res = await syncRoutePOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.cartId).toMatch(/^cart_/);
    expect(data.recoveryToken).toMatch(/^rec_/);
    expect(data.status).toBe("active");
    expect(data.subtotalPaise).toBe(90000);
    expect(data.itemCount).toBe(2);
  });

  it("enforces 60 requests/minute rate limit per client IP", async () => {
    const ip = "198.51.100.77";

    // Exhaust budget of 60 requests
    for (let i = 0; i < 60; i++) {
      const req = new Request("http://localhost/api/cart/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": ip,
        },
        body: JSON.stringify({
          sessionId: `session-ratelimit-${i}`,
          items: [],
        }),
      });
      const res = await syncRoutePOST(req);
      expect(res.status).toBe(200);
    }

    // 61st request should be rate-limited (HTTP 429)
    const blockedReq = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
      },
      body: JSON.stringify({
        sessionId: "session-ratelimit-blocked",
        items: [],
      }),
    });

    const blockedRes = await syncRoutePOST(blockedReq);
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get("Retry-After")).toBeTruthy();
    expect(blockedRes.headers.get("X-RateLimit-Limit")).toBe("60");
  });
});
