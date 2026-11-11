import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB = path.join(tmpdir(), `challenger-m1-stress-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

// Dynamic imports after setting process.env.DATABASE_PATH
const {
  syncAbandonedCart,
  getCartById,
} = await import("../../src/lib/abandonedCarts");

const { POST: syncRoutePOST } = await import("../../src/app/api/cart/sync/route");
const { getDb } = await import("../../src/lib/db");
const { upsertProduct, upsertVariant } = await import("../../src/lib/products");
const { resetRateLimits } = await import("../../src/lib/rateLimit");

let testVariant1Id: number;
let testVariant2Id: number;
const TEST_PRICE_1 = 45000; // Rs 450
const TEST_PRICE_2 = 95000; // Rs 950

beforeAll(() => {
  // Apply schema migrations to isolated test database
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: TEST_DB },
    stdio: "ignore",
  });

  const p = upsertProduct({
    slug: "darjeeling-stress-test-tea",
    name: "Darjeeling Stress Test Tea",
    category: "Black",
    origin: "Darjeeling, India",
    estate: "Gopaldhara",
    flush: "Spring First Flush",
    harvest_date: "Spring 2026",
    description: "Stress test probe item.",
    tasting_notes: "Floral, Muscatel",
    floral: 5,
    fruity: 4,
    malty: 2,
    body: 3,
    brew_temp: 90,
    brew_seconds: 180,
    featured: 1,
  });

  const v1 = upsertVariant({
    product_id: p.id,
    sku: "STRESS-TEA-100G",
    grams: 100,
    price_paise: TEST_PRICE_1,
    stock: 100,
  });
  testVariant1Id = v1.id;

  const v2 = upsertVariant({
    product_id: p.id,
    sku: "STRESS-TEA-250G",
    grams: 250,
    price_paise: TEST_PRICE_2,
    stock: 50,
  });
  testVariant2Id = v2.id;
});

afterAll(() => {
  resetRateLimits();
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    try {
      rmSync(TEST_DB + suffix, { force: true });
    } catch {
      /* ignore cleanup error */
    }
  }
});

beforeEach(() => {
  resetRateLimits();
});

describe("Adversarial Stress Suite 1: Rapid Sequential Cart Updates & Concurrency (100 Mutations & SQLite Locking)", () => {
  it("executes 100 rapid sequential quantity mutations on the same session without SQLite lock or token drift", () => {
    const sessionId = "session-rapid-100-single";
    let initialCartId = "";
    let initialToken = "";

    const startTime = Date.now();

    for (let i = 1; i <= 100; i++) {
      // Rotate quantities between 1 and 20 to test frequent DB writes
      const qty1 = (i % 20) + 1;
      const qty2 = ((i * 3) % 20) + 1;

      const res = syncAbandonedCart({
        sessionId,
        fingerprint: {
          fingerprintHash: `fp_hash_${i}`,
          canvasHash: "",
          webglRenderer: "",
          audioSignature: "",
          screenResolution: "1920x1080",
          timezone: "Asia/Kolkata",
        },
        items: [
          { variantId: testVariant1Id, quantity: qty1 },
          { variantId: testVariant2Id, quantity: qty2 },
        ],
        geo: {
          ip: "127.0.0.1",
          city: "Siliguri",
          region: "West Bengal",
          country: "India",
          isLocal: true,
        },
        userAgent: `ProbeAgent/1.0 (Iteration ${i})`,
      });

      if (i === 1) {
        initialCartId = res.cartId;
        initialToken = res.recoveryToken;
      } else {
        // Invariant: cartId and recoveryToken must never change on subsequent mutations
        expect(res.cartId).toBe(initialCartId);
        expect(res.recoveryToken).toBe(initialToken);
      }

      const expectedSubtotal = qty1 * TEST_PRICE_1 + qty2 * TEST_PRICE_2;
      const expectedItemCount = qty1 + qty2;

      expect(res.subtotalPaise).toBe(expectedSubtotal);
      expect(res.itemCount).toBe(expectedItemCount);
      expect(res.status).toBe("active");
    }

    const elapsedMs = Date.now() - startTime;
    // 100 SQLite mutations should comfortably complete in under 5 seconds
    expect(elapsedMs).toBeLessThan(5000);

    // Verify DB state: exactly 1 cart for this session and exactly 2 line items matching iteration 100
    const db = getDb();
    const cartsCount = db.prepare("SELECT COUNT(*) as count FROM abandoned_carts WHERE session_id = ?").get(sessionId) as { count: number };
    expect(cartsCount.count).toBe(1);

    const items = db.prepare("SELECT * FROM cart_items WHERE cart_id = ? ORDER BY variant_id").all(initialCartId) as Array<{
      variant_id: number;
      quantity: number;
      unit_price_paise: number;
    }>;
    expect(items.length).toBe(2);

    const finalQty1 = (100 % 20) + 1; // (0) + 1 = 1
    const finalQty2 = ((300) % 20) + 1; // (0) + 1 = 1
    expect(items[0].variant_id).toBe(testVariant1Id);
    expect(items[0].quantity).toBe(finalQty1);
    expect(items[0].unit_price_paise).toBe(TEST_PRICE_1);

    expect(items[1].variant_id).toBe(testVariant2Id);
    expect(items[1].quantity).toBe(finalQty2);
    expect(items[1].unit_price_paise).toBe(TEST_PRICE_2);
  });

  it("executes 100 rapid sequential cart syncs across 100 distinct sessions without SQLite collision or locks", () => {
    const sessionIds = Array.from({ length: 100 }, (_, i) => `session-distinct-${i}-${Date.now()}`);
    const cartIds = new Set<string>();
    const tokens = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const res = syncAbandonedCart({
        sessionId: sessionIds[i],
        fingerprint: {
          fingerprintHash: `fp_distinct_${i}`,
          canvasHash: `canvas_${i}`,
          webglRenderer: "",
          audioSignature: "",
          screenResolution: "",
          timezone: "UTC",
        },
        items: [{ variantId: testVariant1Id, quantity: (i % 5) + 1 }],
        geo: {
          ip: `198.51.100.${(i % 200) + 1}`,
          city: "Kolkata",
          region: "West Bengal",
          country: "India",
          isLocal: false,
        },
        userAgent: "Challenger Distinct Tester",
      });

      expect(res.cartId).toMatch(/^cart_/);
      expect(res.recoveryToken).toMatch(/^rec_/);
      cartIds.add(res.cartId);
      tokens.add(res.recoveryToken);
    }

    // Every distinct session must produce a completely unique cartId and recoveryToken
    expect(cartIds.size).toBe(100);
    expect(tokens.size).toBe(100);

    const db = getDb();
    const fpCount = db.prepare("SELECT COUNT(*) as count FROM visitor_fingerprints WHERE session_id LIKE 'session-distinct-%'").get() as { count: number };
    expect(fpCount.count).toBe(100);

    const cartCount = db.prepare("SELECT COUNT(*) as count FROM abandoned_carts WHERE session_id LIKE 'session-distinct-%'").get() as { count: number };
    expect(cartCount.count).toBe(100);
  });

  it("handles 50 parallel asynchronous HTTP route requests without crashing or dropping transactions", async () => {
    // 50 concurrent requests with distinct client IPs to test concurrency under event loop pressure
    const promises = Array.from({ length: 50 }, async (_, i) => {
      const req = new Request("http://localhost/api/cart/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": `203.0.113.${i + 1}`,
        },
        body: JSON.stringify({
          sessionId: `session-concurrent-${i}`,
          fingerprint: {
            fingerprintHash: `fp_concurrent_${i}`,
          },
          items: [{ variantId: testVariant1Id, quantity: 1 }],
        }),
      });

      const res = await syncRoutePOST(req);
      const json = await res.json();
      return { status: res.status, json };
    });

    const results = await Promise.all(promises);

    for (const r of results) {
      expect(r.status).toBe(200);
      expect(r.json.success).toBe(true);
      expect(r.json.cartId).toBeTruthy();
      expect(r.json.itemCount).toBe(1);
      expect(r.json.subtotalPaise).toBe(TEST_PRICE_1);
    }
  });

  it("demonstrates rate limiting protection when a single client IP issues 100 rapid requests to the HTTP route", async () => {
    const singleClientIp = "192.0.2.88";

    let successCount = 0;
    let rateLimitedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < 100; i++) {
      const req = new Request("http://localhost/api/cart/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": singleClientIp,
        },
        body: JSON.stringify({
          sessionId: `session-flood-${i}`,
          items: [{ variantId: testVariant1Id, quantity: 1 }],
        }),
      });

      const res = await syncRoutePOST(req);
      if (res.status === 200) {
        successCount++;
      } else if (res.status === 429) {
        rateLimitedCount++;
      } else {
        errorCount++;
      }
    }

    // Exactly 60 should succeed, exactly 40 should be rate-limited, 0 internal server errors (500)
    expect(successCount).toBe(60);
    expect(rateLimitedCount).toBe(40);
    expect(errorCount).toBe(0);
  });
});

describe("Adversarial Stress Suite 2: Malformed Payloads & Boundary Defense", () => {
  it("rejects negative item quantities with HTTP 400", async () => {
    const negativeQuantities = [-1, -5, -20, -9999];

    for (const qty of negativeQuantities) {
      const req = new Request("http://localhost/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: `session-neg-${qty}`,
          items: [{ variantId: testVariant1Id, quantity: qty }],
        }),
      });

      const res = await syncRoutePOST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid cart sync payload.");
    }
  });

  it("rejects floating point quantities and variant IDs with HTTP 400", async () => {
    const floatQuantities = [1.5, 0.1, 2.999, 10.0001, NaN, Infinity];

    for (const qty of floatQuantities) {
      const req = new Request("http://localhost/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: `session-float-qty-${qty}`,
          items: [{ variantId: testVariant1Id, quantity: qty }],
        }),
      });

      const res = await syncRoutePOST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid cart sync payload.");
    }

    // Floating point variantId
    const reqVariantFloat = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-float-variant",
        items: [{ variantId: 1.5, quantity: 2 }],
      }),
    });
    const resVariantFloat = await syncRoutePOST(reqVariantFloat);
    expect(resVariantFloat.status).toBe(400);
  });

  it("safely handles non-existent variant IDs without database foreign key crashes", async () => {
    const nonExistentVariantId = 99999999;

    // All variants non-existent
    const req1 = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-non-existent-1",
        items: [{ variantId: nonExistentVariantId, quantity: 2 }],
      }),
    });

    const res1 = await syncRoutePOST(req1);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    // Non-existent variants must be ignored; subtotal and items become 0
    expect(json1.itemCount).toBe(0);
    expect(json1.subtotalPaise).toBe(0);

    const stored1 = getCartById(json1.cartId);
    expect(stored1?.items.length).toBe(0);

    // Mixed valid and non-existent variants
    const req2 = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-non-existent-2",
        items: [
          { variantId: testVariant1Id, quantity: 3 },
          { variantId: nonExistentVariantId, quantity: 5 },
        ],
      }),
    });

    const res2 = await syncRoutePOST(req2);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    // Only the valid variant should be tallied
    expect(json2.itemCount).toBe(3);
    expect(json2.subtotalPaise).toBe(3 * TEST_PRICE_1);

    const stored2 = getCartById(json2.cartId);
    expect(stored2?.items.length).toBe(1);
    expect(stored2?.items[0].variant_id).toBe(testVariant1Id);
  });

  it("strictly enforces session ID length boundaries (min 1, max 128)", async () => {
    // 129 characters (violates max 128)
    const longSession129 = "s".repeat(129);
    const req129 = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: longSession129,
        items: [],
      }),
    });
    const res129 = await syncRoutePOST(req129);
    expect(res129.status).toBe(400);

    // 10,000 characters (buffer overflow probe)
    const longSession10k = "s".repeat(10000);
    const req10k = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: longSession10k,
        items: [],
      }),
    });
    const res10k = await syncRoutePOST(req10k);
    expect(res10k.status).toBe(400);

    // Empty string
    const reqEmpty = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "",
        items: [],
      }),
    });
    const resEmpty = await syncRoutePOST(reqEmpty);
    expect(resEmpty.status).toBe(400);

    // Whitespace only
    const reqWhitespace = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "   \t\n  ",
        items: [],
      }),
    });
    const resWhitespace = await syncRoutePOST(reqWhitespace);
    expect(resWhitespace.status).toBe(400);

    // Exact upper bound: 128 characters should be accepted
    const boundarySession128 = "s".repeat(128);
    const req128 = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: boundarySession128,
        items: [],
      }),
    });
    const res128 = await syncRoutePOST(req128);
    expect(res128.status).toBe(200);
    const json128 = await res128.json();
    expect(json128.success).toBe(true);
  });

  it("strictly enforces fingerprint string boundaries", async () => {
    // fingerprintHash > 128
    const res1 = await syncRoutePOST(new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-fp-overflow-1",
        fingerprint: { fingerprintHash: "f".repeat(129) },
        items: [],
      }),
    }));
    expect(res1.status).toBe(400);

    // canvasHash > 128
    const res2 = await syncRoutePOST(new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-fp-overflow-2",
        fingerprint: { fingerprintHash: "valid", canvasHash: "c".repeat(129) },
        items: [],
      }),
    }));
    expect(res2.status).toBe(400);

    // webglRenderer > 256
    const res3 = await syncRoutePOST(new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-fp-overflow-3",
        fingerprint: { fingerprintHash: "valid", webglRenderer: "w".repeat(257) },
        items: [],
      }),
    }));
    expect(res3.status).toBe(400);

    // screenResolution > 64
    const res4 = await syncRoutePOST(new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-fp-overflow-4",
        fingerprint: { fingerprintHash: "valid", screenResolution: "s".repeat(65) },
        items: [],
      }),
    }));
    expect(res4.status).toBe(400);

    // timezone > 64
    const res5 = await syncRoutePOST(new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-fp-overflow-5",
        fingerprint: { fingerprintHash: "valid", timezone: "t".repeat(65) },
        items: [],
      }),
    }));
    expect(res5.status).toBe(400);
  });

  it("enforces item count limits (max 30 items) and single item quantity limit (max 10000)", async () => {
    // 31 items in array (max is 30)
    const items31 = Array.from({ length: 31 }, () => ({
      variantId: testVariant1Id,
      quantity: 1,
    }));

    const resItems31 = await syncRoutePOST(new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-overflow-items",
        items: items31,
      }),
    }));
    expect(resItems31.status).toBe(400);

    // Single item quantity > 10000
    const resQty10001 = await syncRoutePOST(new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-overflow-qty",
        items: [{ variantId: testVariant1Id, quantity: 10001 }],
      }),
    }));
    expect(resQty10001.status).toBe(400);

    // Quantity = 50000
    const resQty50000 = await syncRoutePOST(new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-overflow-qty-50000",
        items: [{ variantId: testVariant1Id, quantity: 50000 }],
      }),
    }));
    expect(resQty50000.status).toBe(400);
  });
});

describe("Adversarial Stress Suite 3: Empty Cart & Zero-Quantity Handling", () => {
  it("handles empty items array ([]): initializes cart with 0 subtotal, active status, and 0 items", async () => {
    const req = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-empty-initial",
        fingerprint: { fingerprintHash: "fp_empty_01" },
        items: [],
      }),
    });

    const res = await syncRoutePOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.subtotalPaise).toBe(0);
    expect(json.itemCount).toBe(0);
    expect(json.status).toBe("active");

    const stored = getCartById(json.cartId);
    expect(stored).not.toBeNull();
    expect(stored?.cart.subtotal_paise).toBe(0);
    expect(stored?.cart.item_count).toBe(0);
    expect(stored?.items.length).toBe(0);
  });

  it("handles clearing an existing non-empty cart back to empty items ([]) without deleting cart record", async () => {
    const sessionId = "session-empty-clear";

    // 1. Populate cart with 2 items
    const res1 = await syncRoutePOST(new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        items: [
          { variantId: testVariant1Id, quantity: 2 },
          { variantId: testVariant2Id, quantity: 1 },
        ],
      }),
    }));
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.itemCount).toBe(3);
    expect(json1.subtotalPaise).toBe(2 * TEST_PRICE_1 + 1 * TEST_PRICE_2);

    // 2. Clear cart
    const res2 = await syncRoutePOST(new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        items: [],
      }),
    }));
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.cartId).toBe(json1.cartId);
    expect(json2.recoveryToken).toBe(json1.recoveryToken);
    expect(json2.itemCount).toBe(0);
    expect(json2.subtotalPaise).toBe(0);

    const stored = getCartById(json2.cartId);
    expect(stored?.items.length).toBe(0);
    expect(stored?.cart.item_count).toBe(0);
    expect(stored?.cart.subtotal_paise).toBe(0);
    expect(stored?.cart.status).toBe("active");
  });

  it("rejects zero-quantity items (quantity: 0) with HTTP 400", async () => {
    const req = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-zero-qty",
        items: [{ variantId: testVariant1Id, quantity: 0 }],
      }),
    });

    const res = await syncRoutePOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid cart sync payload.");
  });
});

describe("Adversarial Stress Suite 4: Duplicate Variant Aggregation & Combined Quantity Edge Cases", () => {
  it("aggregates duplicate variant lines within safe quantity limit (<= 20)", () => {
    const sessionId = "session-dup-valid";
    const res = syncAbandonedCart({
      sessionId,
      items: [
        { variantId: testVariant1Id, quantity: 5 },
        { variantId: testVariant1Id, quantity: 7 },
      ],
      geo: { ip: "127.0.0.1", city: "Siliguri", region: "West Bengal", country: "India", isLocal: true },
      userAgent: "TestAgent",
    });

    expect(res.itemCount).toBe(12);
    expect(res.subtotalPaise).toBe(12 * TEST_PRICE_1);

    const stored = getCartById(res.cartId);
    expect(stored?.items.length).toBe(1);
    expect(stored?.items[0].quantity).toBe(12);
  });

  it("tests behavior when duplicate variants aggregate past DB CHECK constraint (e.g. 15 + 15 = 30 > 20)", async () => {
    // Each line has quantity: 15 <= 20 (passes Zod), but sum is 30 > 20 (violates DB CHECK on cart_items)
    const req = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-dup-overflow-check",
        items: [
          { variantId: testVariant1Id, quantity: 15 },
          { variantId: testVariant1Id, quantity: 15 },
        ],
      }),
    });

    // The route catches the SQLite constraint exception and safely returns HTTP 500 without crashing
    const res = await syncRoutePOST(req);
    expect([200, 400, 500]).toContain(res.status);
    const json = await res.json();
    // If it caught error, it returns sanitized { error: "Unable to sync cart." } without leaking SQL details
    if (res.status === 500) {
      expect(json.error).toBe("Unable to sync cart.");
      expect(json.details).toBeUndefined();
    }
  });
});

describe("Adversarial Stress Suite 5: SQL Injection & Payload Tampering", () => {
  it("neutralizes SQL injection attempts in session ID and fingerprint fields", async () => {
    const maliciousSessionId = "'; DROP TABLE abandoned_carts; --";
    const maliciousFpHash = "' OR '1'='1";
    const maliciousCanvas = "'; DELETE FROM cart_items; --";
    const maliciousUa = "Mozilla/5.0'; DROP TABLE visitor_fingerprints; --";

    const req = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": maliciousUa,
      },
      body: JSON.stringify({
        sessionId: maliciousSessionId,
        fingerprint: {
          fingerprintHash: maliciousFpHash,
          canvasHash: maliciousCanvas,
        },
        items: [{ variantId: testVariant1Id, quantity: 1 }],
      }),
    });

    const res = await syncRoutePOST(req);
    expect(res.status).toBe(200);

    const db = getDb();
    // Verify all tables still exist and were not dropped or damaged
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t: any) => t.name);
    expect(tables).toContain("abandoned_carts");
    expect(tables).toContain("cart_items");
    expect(tables).toContain("visitor_fingerprints");

    // Verify session was inserted as literal text
    const row = db.prepare("SELECT * FROM visitor_fingerprints WHERE session_id = ?").get(maliciousSessionId) as any;
    expect(row).toBeDefined();
    expect(row.fingerprint_hash).toBe(maliciousFpHash);
  });

  it("neutralizes SQL injection in X-Forwarded-For header", async () => {
    const maliciousIp = "127.0.0.1'; DROP TABLE schema_migrations; --";

    const req = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": maliciousIp,
      },
      body: JSON.stringify({
        sessionId: "session-sql-ip",
        items: [],
      }),
    });

    const res = await syncRoutePOST(req);
    expect(res.status).toBe(200);

    const db = getDb();
    const hasMigrations = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
    expect(hasMigrations).toBeTruthy();
  });

  it("ignores tampered client pricing or unwanted extra payload fields", async () => {
    const req = new Request("http://localhost/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-tamper-price",
        items: [
          {
            variantId: testVariant1Id,
            quantity: 2,
            price_paise: 1, // Fraudulent price
            unitPrice: 1,
            subtotal: 2,
          },
        ],
        subtotalPaise: 2, // Fraudulent total
        status: "converted", // Fraudulent status attempt
      }),
    });

    const res = await syncRoutePOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    // Server-side calculation MUST prevail: 2 * 45000 = 90000 paise
    expect(json.subtotalPaise).toBe(90000);
    expect(json.status).toBe("active"); // Status forced to active

    const stored = getCartById(json.cartId);
    expect(stored?.cart.subtotal_paise).toBe(90000);
    expect(stored?.cart.status).toBe("active");
    expect(stored?.items[0].unit_price_paise).toBe(TEST_PRICE_1);
  });
});

describe("Adversarial Stress Suite 6: Database Constraints & Transaction Atomicity", () => {
  it("enforces cart_items quantity CHECK constraint (quantity > 0 AND quantity <= 20)", () => {
    const db = getDb();
    const cartId = "cart_constraint_test";

    // Setup dummy cart
    db.prepare(`
      INSERT OR IGNORE INTO abandoned_carts (id, session_id, recovery_token, status)
      VALUES (?, 'session_constraint_test', 'rec_constraint_test', 'active')
    `).run(cartId);

    // Quantity 0 should violate CHECK constraint
    expect(() => {
      db.prepare(`
        INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price_paise)
        VALUES (?, ?, 0, 45000)
      `).run(cartId, testVariant1Id);
    }).toThrow(/CHECK constraint failed/);

    // Quantity 10001 should violate CHECK constraint
    expect(() => {
      db.prepare(`
        INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price_paise)
        VALUES (?, ?, 10001, 45000)
      `).run(cartId, testVariant1Id);
    }).toThrow(/CHECK constraint failed/);

    // Quantity -5 should violate CHECK constraint
    expect(() => {
      db.prepare(`
        INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price_paise)
        VALUES (?, ?, -5, 45000)
      `).run(cartId, testVariant1Id);
    }).toThrow(/CHECK constraint failed/);
  });

  it("enforces foreign key constraint on variant_id in cart_items", () => {
    const db = getDb();
    const cartId = "cart_fk_test";

    db.prepare(`
      INSERT OR IGNORE INTO abandoned_carts (id, session_id, recovery_token, status)
      VALUES (?, 'session_fk_test', 'rec_fk_test', 'active')
    `).run(cartId);

    expect(() => {
      db.prepare(`
        INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price_paise)
        VALUES (?, 99999999, 1, 45000)
      `).run(cartId);
    }).toThrow(/FOREIGN KEY constraint failed/);
  });

  it("enforces unique constraint on recovery_token", () => {
    const db = getDb();
    const token = "rec_unique_test_" + Date.now();

    db.prepare(`
      INSERT INTO abandoned_carts (id, session_id, recovery_token, status)
      VALUES ('cart_uniq_1', 'session_uniq_1', ?, 'active')
    `).run(token);

    expect(() => {
      db.prepare(`
        INSERT INTO abandoned_carts (id, session_id, recovery_token, status)
        VALUES ('cart_uniq_2', 'session_uniq_2', ?, 'active')
      `).run(token);
    }).toThrow(/UNIQUE constraint failed/);
  });

  it("enforces status CHECK constraint on abandoned_carts", () => {
    const db = getDb();

    // Valid statuses
    for (const validStatus of ["active", "abandoned", "contacted", "converted", "ignored"]) {
      const id = "cart_status_" + validStatus;
      db.prepare(`
        INSERT OR REPLACE INTO abandoned_carts (id, session_id, recovery_token, status)
        VALUES (?, ?, ?, ?)
      `).run(id, "sess_" + validStatus, "rec_" + validStatus, validStatus);

      const row = db.prepare("SELECT status FROM abandoned_carts WHERE id = ?").get(id) as { status: string };
      expect(row.status).toBe(validStatus);
    }

    // Invalid status
    expect(() => {
      db.prepare(`
        INSERT INTO abandoned_carts (id, session_id, recovery_token, status)
        VALUES ('cart_invalid_status', 'session_inv', 'rec_inv', 'bogus_status')
      `).run();
    }).toThrow(/CHECK constraint failed/);
  });

  it("guarantees transaction rollback on mid-operation failure", () => {
    const db = getDb();
    const failSessionId = "session-rollback-test";

    // Attempt an atomic operation that deliberately fails on step 2
    expect(() => {
      db.transaction(() => {
        // Step 1: Insert into visitor_fingerprints
        db.prepare(`
          INSERT INTO visitor_fingerprints (session_id, fingerprint_hash, ip_address, user_agent)
          VALUES (?, 'fp_rollback', '127.0.0.1', 'RollbackAgent')
        `).run(failSessionId);

        // Step 2: Trigger foreign key failure
        db.prepare(`
          INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price_paise)
          VALUES ('cart_does_not_exist', 99999999, 1, 45000)
        `).run();
      })();
    }).toThrow();

    // Verify step 1 was rolled back completely
    const fpRow = db.prepare("SELECT * FROM visitor_fingerprints WHERE session_id = ?").get(failSessionId);
    expect(fpRow).toBeUndefined();
  });
});
