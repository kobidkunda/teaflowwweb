import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { randomUUID } from "node:crypto";

const TEST_DB = path.join(tmpdir(), `adversarial-conversion-geo-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

const {
  extractClientIp,
  isPrivateIp,
  extractGeo,
} = await import("../../src/lib/geo");

const {
  syncAbandonedCart,
  markCartConverted,
  getCartById,
} = await import("../../src/lib/abandonedCarts");

const { createDemoOrder, CheckoutError } = await import("../../src/lib/checkout");
const { getDb } = await import("../../src/lib/db");
const { upsertProduct, upsertVariant } = await import("../../src/lib/products");
const { POST: syncRoutePOST } = await import("../../src/app/api/cart/sync/route");
const { resetRateLimits } = await import("../../src/lib/rateLimit");

let testVariantId: number;
let limitedVariantId: number;

beforeAll(() => {
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: TEST_DB },
    stdio: "ignore",
  });

  const product = upsertProduct({
    slug: "adversarial-makaibari-estate",
    name: "Makaibari Silver Tips",
    category: "White",
    origin: "Kurseong, Darjeeling",
    estate: "Makaibari",
    flush: "First Flush",
    harvest_date: "Spring 2026",
    description: "Adversarial test tea specimen.",
    tasting_notes: "Floral, Silky, Peach",
    floral: 5,
    fruity: 5,
    malty: 1,
    body: 2,
    brew_temp: 85,
    brew_seconds: 240,
    featured: 1,
  });

  const v1 = upsertVariant({
    product_id: product.id,
    sku: "MAKAI-SILVER-100",
    grams: 100,
    price_paise: 65000, // Rs 650
    stock: 50,
  });
  testVariantId = v1.id;

  const v2 = upsertVariant({
    product_id: product.id,
    sku: "MAKAI-SILVER-LIMITED",
    grams: 50,
    price_paise: 35000, // Rs 350
    stock: 2, // Low stock for adversarial failure testing
  });
  limitedVariantId = v2.id;
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

/* ==========================================================================
 * SECTION 1: ORDER CHECKOUT CONVERSION ADVERSARIAL TESTING
 * ========================================================================== */

describe("Adversarial Suite 1: Order Checkout Conversion", () => {
  it("converts active cart to 'converted' and records converted_order_id via createDemoOrder", () => {
    const sid = "adv-session-convert-1";
    const syncRes = syncAbandonedCart({
      sessionId: sid,
      items: [{ variantId: testVariantId, quantity: 2 }],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "VitestAdversarial/1.0",
    });

    expect(syncRes.status).toBe("active");
    expect(syncRes.subtotalPaise).toBe(130000);
    expect(syncRes.itemCount).toBe(2);

    // Verify initial active cart in database
    const initialCart = getCartById(syncRes.cartId);
    expect(initialCart?.cart.status).toBe("active");
    expect(initialCart?.cart.converted_order_id).toBeNull();

    // Place order
    const orderRes = createDemoOrder({
      name: "Tenzing Sherpa",
      email: "tenzing.sherpa@example.com",
      address: "Estate Bungalow 4, Makaibari, Kurseong",
      phone: "+919876500001",
      idempotencyKey: randomUUID(),
      sessionId: sid,
      items: [{ variantId: testVariantId, quantity: 2 }],
    });

    expect(orderRes.orderId).toBeTruthy();
    expect(orderRes.deduped).toBe(false);

    // Verify post-checkout conversion
    const convertedCart = getCartById(syncRes.cartId);
    expect(convertedCart?.cart.status).toBe("converted");
    expect(convertedCart?.cart.converted_order_id).toBe(orderRes.orderId);
    expect(convertedCart?.cart.customer_name).toBe("Tenzing Sherpa");
    expect(convertedCart?.cart.customer_email).toBe("tenzing.sherpa@example.com");
    expect(convertedCart?.cart.customer_phone).toBe("+919876500001");
  });

  it("converts cart by customer_phone fallback when sessionId is omitted", () => {
    const db = getDb();
    const sid = "adv-session-phone-only";
    const testPhone = "+919876500002";

    const syncRes = syncAbandonedCart({
      sessionId: sid,
      items: [{ variantId: testVariantId, quantity: 1 }],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "VitestAdversarial/1.0",
    });

    // Attach phone to cart
    db.prepare("UPDATE abandoned_carts SET customer_phone = ? WHERE id = ?").run(testPhone, syncRes.cartId);

    // Place order WITHOUT sessionId, only phone
    const orderRes = createDemoOrder({
      name: "Kiran Chettri",
      email: "kiran@example.com",
      address: "Darjeeling Mall Road, Darjeeling",
      phone: testPhone,
      idempotencyKey: randomUUID(),
      // sessionId is intentionally omitted
      items: [{ variantId: testVariantId, quantity: 1 }],
    });

    const convertedCart = getCartById(syncRes.cartId);
    expect(convertedCart?.cart.status).toBe("converted");
    expect(convertedCart?.cart.converted_order_id).toBe(orderRes.orderId);
    expect(convertedCart?.cart.customer_phone).toBe(testPhone);
  });

  it("converts cart by customer_email fallback when sessionId and phone are omitted", () => {
    const db = getDb();
    const sid = "adv-session-email-only";
    const testEmail = "anita.gurung@example.com";

    const syncRes = syncAbandonedCart({
      sessionId: sid,
      items: [{ variantId: testVariantId, quantity: 1 }],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "VitestAdversarial/1.0",
    });

    // Attach email to cart
    db.prepare("UPDATE abandoned_carts SET customer_email = ? WHERE id = ?").run(testEmail, syncRes.cartId);

    // Place order WITHOUT sessionId and WITHOUT phone
    const orderRes = createDemoOrder({
      name: "Anita Gurung",
      email: testEmail,
      address: "Lebong Cart Road, Darjeeling",
      idempotencyKey: randomUUID(),
      items: [{ variantId: testVariantId, quantity: 1 }],
    });

    const convertedCart = getCartById(syncRes.cartId);
    expect(convertedCart?.cart.status).toBe("converted");
    expect(convertedCart?.cart.converted_order_id).toBe(orderRes.orderId);
    expect(convertedCart?.cart.customer_email).toBe(testEmail);
  });

  it("maintains cart conversion state and converted_order_id on deduped idempotent order submission", () => {
    const sid = "adv-session-dedupe";
    const syncRes = syncAbandonedCart({
      sessionId: sid,
      items: [{ variantId: testVariantId, quantity: 1 }],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "VitestAdversarial/1.0",
    });

    const idempotencyKey = randomUUID();

    // First attempt
    const firstOrder = createDemoOrder({
      name: "Prabhat Roy",
      email: "prabhat@example.com",
      address: "Gandhi Road, Darjeeling",
      phone: "+919876500003",
      idempotencyKey,
      sessionId: sid,
      items: [{ variantId: testVariantId, quantity: 1 }],
    });
    expect(firstOrder.deduped).toBe(false);

    // Second attempt with identical idempotencyKey
    const secondOrder = createDemoOrder({
      name: "Prabhat Roy",
      email: "prabhat@example.com",
      address: "Gandhi Road, Darjeeling",
      phone: "+919876500003",
      idempotencyKey,
      sessionId: sid,
      items: [{ variantId: testVariantId, quantity: 1 }],
    });
    expect(secondOrder.deduped).toBe(true);
    expect(secondOrder.orderId).toBe(firstOrder.orderId);

    // Cart must stay converted with original orderId
    const storedCart = getCartById(syncRes.cartId);
    expect(storedCart?.cart.status).toBe("converted");
    expect(storedCart?.cart.converted_order_id).toBe(firstOrder.orderId);
  });

  it("does NOT resurrect converted cart on subsequent sync but initializes a fresh active cart", () => {
    const sid = "adv-session-resurrection-check";

    // 1. Initial cart and conversion
    const firstSync = syncAbandonedCart({
      sessionId: sid,
      items: [{ variantId: testVariantId, quantity: 1 }],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "VitestAdversarial/1.0",
    });

    const orderRes = createDemoOrder({
      name: "Karma Wangchuk",
      email: "karma@example.com",
      address: "Thimphu Expressway",
      phone: "+919876500004",
      idempotencyKey: randomUUID(),
      sessionId: sid,
      items: [{ variantId: testVariantId, quantity: 1 }],
    });

    const firstCartAfterOrder = getCartById(firstSync.cartId);
    expect(firstCartAfterOrder?.cart.status).toBe("converted");
    expect(firstCartAfterOrder?.cart.converted_order_id).toBe(orderRes.orderId);

    // 2. Shopper continues browsing with SAME sessionId and adds a new item
    const secondSync = syncAbandonedCart({
      sessionId: sid,
      items: [{ variantId: testVariantId, quantity: 3 }],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "VitestAdversarial/1.0",
    });

    // Must be a DIFFERENT cart ID and recovery token
    expect(secondSync.cartId).not.toBe(firstSync.cartId);
    expect(secondSync.recoveryToken).not.toBe(firstSync.recoveryToken);
    expect(secondSync.status).toBe("active");
    expect(secondSync.itemCount).toBe(3);

    // Original cart MUST remain converted and uncorrupted
    const originalCartRecheck = getCartById(firstSync.cartId);
    expect(originalCartRecheck?.cart.status).toBe("converted");
    expect(originalCartRecheck?.cart.converted_order_id).toBe(orderRes.orderId);
  });

  it("rolls back order creation and leaves cart in 'active' state if checkout throws", () => {
    const sid = "adv-session-rollback-test";

    const syncRes = syncAbandonedCart({
      sessionId: sid,
      items: [{ variantId: limitedVariantId, quantity: 1 }],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "VitestAdversarial/1.0",
    });

    expect(syncRes.status).toBe("active");

    // Attempt checkout exceeding stock (limitedVariant has stock: 2, requesting 10)
    expect(() => {
      createDemoOrder({
        name: "Greedy Shopper",
        email: "greedy@example.com",
        address: "Overstock Road",
        idempotencyKey: randomUUID(),
        sessionId: sid,
        items: [{ variantId: limitedVariantId, quantity: 10 }],
      });
    }).toThrow(CheckoutError);

    // Verify cart remains strictly 'active' and converted_order_id is still null
    const cartAfterFailure = getCartById(syncRes.cartId);
    expect(cartAfterFailure?.cart.status).toBe("active");
    expect(cartAfterFailure?.cart.converted_order_id).toBeNull();
  });

  it("safely returns false in markCartConverted when cart is not found or params are invalid", () => {
    const db = getDb();
    const resultNonExistent = markCartConverted(db, {
      orderId: randomUUID(),
      sessionId: "completely-non-existent-session-id",
    });
    expect(resultNonExistent).toBe(false);

    const resultEmpty = markCartConverted(db, {
      orderId: randomUUID(),
    });
    expect(resultEmpty).toBe(false);
  });
});

/* ==========================================================================
 * SECTION 2: GEOLOCATION & IP EXTRACTION ADVERSARIAL TESTING
 * ========================================================================== */

describe("Adversarial Suite 2: Geolocation & Spoofed IP Edge Cases", () => {
  describe("2.1 IPv6 Localhost (::1)", () => {
    it("extracts ::1 from x-forwarded-for, identifies as private, and falls back to Siliguri", () => {
      const req = new Request("http://localhost/api/test", {
        headers: { "x-forwarded-for": "::1" },
      });

      const ip = extractClientIp(req);
      expect(ip).toBe("::1");
      expect(isPrivateIp(ip)).toBe(true);

      const geo = extractGeo(req);
      expect(geo.ip).toBe("::1");
      expect(geo.isLocal).toBe(true);
      expect(geo.city).toBe("Siliguri");
      expect(geo.region).toBe("West Bengal");
      expect(geo.country).toBe("India");
    });
  });

  describe("2.2 Multiple Comma-Separated Proxy IPs in x-forwarded-for", () => {
    it("extracts first hop correctly from multiple proxies", () => {
      const req = new Request("http://localhost/api/test", {
        headers: {
          "x-forwarded-for": "203.0.113.195, 10.0.0.1, 192.168.1.1, 172.16.0.1",
        },
      });
      expect(extractClientIp(req)).toBe("203.0.113.195");
      expect(isPrivateIp("203.0.113.195")).toBe(false);
    });

    it("handles irregular whitespace around commas", () => {
      const req = new Request("http://localhost/api/test", {
        headers: {
          "x-forwarded-for": "   203.0.113.50   ,   10.0.0.1  , 127.0.0.1 ",
        },
      });
      expect(extractClientIp(req)).toBe("203.0.113.50");
    });

    it("handles 10+ proxy hops chain without crashing or regex degradation", () => {
      const longChain = "198.51.100.1, " + Array.from({ length: 15 }, (_, i) => `10.0.${i}.1`).join(", ");
      const req = new Request("http://localhost/api/test", {
        headers: { "x-forwarded-for": longChain },
      });
      expect(extractClientIp(req)).toBe("198.51.100.1");
    });

    it("falls through cleanly when leading hops are empty commas", () => {
      const req = new Request("http://localhost/api/test", {
        headers: {
          "x-forwarded-for": ",  , 198.51.100.2",
          "x-real-ip": "198.51.100.99",
        },
      });
      // Leading hop is empty, so it falls through to x-real-ip
      expect(extractClientIp(req)).toBe("198.51.100.99");
    });
  });

  describe("2.3 Private RFC1918 & Local IP Addresses", () => {
    const privateIps = [
      "10.0.0.1",
      "10.255.255.254",
      "172.16.0.1",
      "172.24.100.5",
      "172.31.255.254",
      "192.168.0.1",
      "192.168.1.1",
      "192.168.254.254",
      "169.254.169.254", // Link-local / cloud metadata
      "127.0.0.1",
      "::1",
      "localhost",
      "0.0.0.0",
      "unknown",
      "fe80::1", // IPv6 Link-local
      "fc00::1", // IPv6 ULA
      "fd12:3456:789a::1", // IPv6 ULA
    ];

    for (const ip of privateIps) {
      it(`identifies ${ip} as private/local and triggers Siliguri fallback`, () => {
        expect(isPrivateIp(ip)).toBe(true);

        const req = new Request("http://localhost/api/test", {
          headers: { "x-forwarded-for": ip },
        });

        const geo = extractGeo(req);
        expect(geo.isLocal).toBe(true);
        expect(geo.city).toBe("Siliguri");
        expect(geo.region).toBe("West Bengal");
        expect(geo.country).toBe("India");
      });
    }
  });

  describe("2.4 Public Boundary IPs (Non-Private)", () => {
    const publicIps = [
      "172.15.255.255", // Just below RFC 1918 172.16
      "172.32.0.1",     // Just above RFC 1918 172.31
      "9.255.255.255",  // Just below RFC 1918 10.0
      "11.0.0.1",       // Just above RFC 1918 10.255
      "192.167.255.255",// Just below RFC 1918 192.168
      "192.169.0.1",    // Just above RFC 1918 192.168
      "1.1.1.1",
      "8.8.8.8",
      "203.0.113.1",
    ];

    for (const ip of publicIps) {
      it(`correctly identifies ${ip} as public (non-local)`, () => {
        expect(isPrivateIp(ip)).toBe(false);
      });
    }
  });

  describe("2.5 Malformed & Adversarial IP Strings", () => {
    const malformedStrings = [
      "not-an-ip",
      "999.999.999.999",
      "1.2.3",
      "1.2.3.4.5",
      "<script>alert('xss')</script>",
      "' OR '1'='1",
      "../../../../etc/passwd",
      "; DROP TABLE visitor_fingerprints; --",
      "null",
      "undefined",
      "NaN",
      "[2001:db8::1]",
      "192.168.1.1:8080",
      "[::1]:8080",
      encodeURIComponent("🍵.🏠.🌿.🌱"),
      "A".repeat(5000), // Massive payload test
    ];

    for (const str of malformedStrings) {
      it(`handles malformed IP string safely without throwing: "${str.slice(0, 30)}"`, () => {
        const req = new Request("http://localhost/api/test", {
          headers: { "x-forwarded-for": str },
        });

        let ip = "";
        expect(() => {
          ip = extractClientIp(req);
        }).not.toThrow();

        expect(() => {
          isPrivateIp(ip);
        }).not.toThrow();

        let geo: ReturnType<typeof extractGeo> | undefined;
        expect(() => {
          geo = extractGeo(req);
        }).not.toThrow();

        expect(geo).toBeDefined();
        expect(typeof geo?.city).toBe("string");
        expect(typeof geo?.region).toBe("string");
        expect(typeof geo?.country).toBe("string");
        expect(typeof geo?.isLocal).toBe("boolean");
      });
    }
  });

  describe("2.6 Edge CDN Geo Header Decoding & Malformed Headers", () => {
    it("handles corrupt URI-encoded edge headers without unhandled URIError", () => {
      const req = new Request("http://localhost/api/test", {
        headers: {
          "x-forwarded-for": "103.21.244.2", // Public IP
          "x-vercel-ip-country": "IN",
          "x-vercel-ip-country-region": "West Bengal",
          "x-vercel-ip-city": "%E0%A4%A", // Malformed UTF-8 percent-encoding
        },
      });

      let geo: ReturnType<typeof extractGeo> | undefined;
      expect(() => {
        geo = extractGeo(req);
      }).not.toThrow();

      expect(geo?.isLocal).toBe(false);
      // Safe fallback returns raw string instead of crashing
      expect(geo?.city).toBe("%E0%A4%A");
    });

    it("falls back to default location when public IP lacks any edge CDN geo headers", () => {
      const req = new Request("http://localhost/api/test", {
        headers: {
          "x-forwarded-for": "203.0.113.1",
        },
      });

      const geo = extractGeo(req);
      expect(geo.isLocal).toBe(false);
      expect(geo.city).toBe("Siliguri");
      expect(geo.region).toBe("West Bengal");
      expect(geo.country).toBe("India");
    });

    it("respects provider precedence: Vercel over Cloudflare over x-geo", () => {
      const req = new Request("http://localhost/api/test", {
        headers: {
          "x-forwarded-for": "103.21.244.2",
          "x-vercel-ip-country": "JP",
          "cf-ipcountry": "GB",
          "x-geo-country": "FR",
        },
      });

      const geo = extractGeo(req);
      expect(geo.country).toBe("JP");
    });
  });

  describe("2.7 End-to-End POST /api/cart/sync with Adversarial IP Payloads", () => {
    it("successfully persists cart under IPv6 localhost (::1)", async () => {
      const req = new Request("http://localhost/api/cart/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "::1",
        },
        body: JSON.stringify({
          sessionId: "adv-sync-ipv6",
          items: [{ variantId: testVariantId, quantity: 1 }],
        }),
      });

      const res = await syncRoutePOST(req);
      expect(res.status).toBe(200);

      const db = getDb();
      const fp = db.prepare("SELECT * FROM visitor_fingerprints WHERE session_id = ?").get("adv-sync-ipv6") as any;
      expect(fp).toBeDefined();
      expect(fp.ip_address).toBe("::1");
      expect(fp.ip_city).toBe("Siliguri");
    });

    it("safely stores hostile SQL injection string in ip_address without query corruption", async () => {
      const hostileIp = "127.0.0.1'); DROP TABLE visitor_fingerprints; --";
      const req = new Request("http://localhost/api/cart/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": hostileIp,
        },
        body: JSON.stringify({
          sessionId: "adv-sync-sqli-ip",
          items: [{ variantId: testVariantId, quantity: 1 }],
        }),
      });

      const res = await syncRoutePOST(req);
      expect(res.status).toBe(200);

      const db = getDb();
      // Table must still exist and be intact
      const tableCheck = db.prepare("SELECT count(*) as count FROM visitor_fingerprints").get() as any;
      expect(tableCheck.count).toBeGreaterThan(0);

      const fp = db.prepare("SELECT * FROM visitor_fingerprints WHERE session_id = ?").get("adv-sync-sqli-ip") as any;
      expect(fp).toBeDefined();
      expect(fp.ip_address).toBe(hostileIp);
    });

    it("handles multi-proxy x-forwarded-for chain with RFC1918 IPs in API route", async () => {
      const req = new Request("http://localhost/api/cart/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.0.0.1, 192.168.1.1, 172.16.0.1",
        },
        body: JSON.stringify({
          sessionId: "adv-sync-rfc1918",
          items: [{ variantId: testVariantId, quantity: 1 }],
        }),
      });

      const res = await syncRoutePOST(req);
      expect(res.status).toBe(200);

      const db = getDb();
      const fp = db.prepare("SELECT * FROM visitor_fingerprints WHERE session_id = ?").get("adv-sync-rfc1918") as any;
      expect(fp).toBeDefined();
      expect(fp.ip_address).toBe("10.0.0.1");
      expect(fp.ip_city).toBe("Siliguri");
      expect(fp.ip_region).toBe("West Bengal");
      expect(fp.ip_country).toBe("India");
    });
  });
});
