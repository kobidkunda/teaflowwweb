import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync, rmSync } from "node:fs";

// t2 leftovers: GST-inclusive tax persistence, 8-char lookup hardening,
// demo-seed fencing (static guards — no fabricated claims may ship).
const TEST_DB = path.join(tmpdir(), `t2-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

const { calculateTaxPaise, quoteTotals, GST_RATE_PERCENT } = await import(
  "../../src/lib/money"
);
const { createDemoOrder } = await import("../../src/lib/checkout");
const { getPublicOrder } = await import("../../src/lib/storefront");
const { GET: lookupGET } = await import(
  "../../src/app/api/orders/lookup/route"
);
const { RATE_LIMITS, resetRateLimits } = await import(
  "../../src/lib/rateLimit"
);
const { getDb } = await import("../../src/lib/db");
const { upsertProduct, upsertVariant } = await import(
  "../../src/lib/products"
);

let variantId = 0;
let keySeq = 0;
const key = () => {
  keySeq += 1;
  return `aaaaaaaa-aaaa-4aaa-8aaa-${String(keySeq).padStart(12, "0")}`;
};

beforeAll(() => {
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: TEST_DB },
    stdio: "ignore",
  });
  const product = upsertProduct({
    slug: "t2-tea", name: "T2 Tea", category: "Black",
    origin: "Test origin", estate: "Test estate", flush: "Spring",
    harvest_date: "2026 harvest", description: "T2 test tea.",
    tasting_notes: "Malty", floral: 1, fruity: 1, malty: 5, body: 4,
    brew_temp: 90, brew_seconds: 180, featured: 0,
  });
  variantId = upsertVariant({
    product_id: product.id, sku: "T2-T-100", grams: 100,
    price_paise: 50000, stock: 50,
  }).id;
  resetRateLimits();
});

afterAll(() => {
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    try { rmSync(TEST_DB + suffix, { force: true }); } catch { /* ignore */ }
  }
});

const mkOrder = (qty: number) =>
  createDemoOrder({
    name: "T2 Customer", email: "t2@example.com",
    address: "44 T2 Street, Demo City", idempotencyKey: key(),
    items: [{ variantId, quantity: qty }],
  });

describe("GST-inclusive tax computation (money.ts)", () => {
  it("breaks out the inclusive portion without changing the total", () => {
    expect(GST_RATE_PERCENT).toBe(5);
    // 100000 incl. 5% → 100000 × 5/105 = 4761.9 → 4762.
    expect(calculateTaxPaise(100000)).toBe(4762);
    expect(calculateTaxPaise(0)).toBe(0);
    expect(calculateTaxPaise(-5)).toBe(0);
  });
  it("quoteTotals keeps total = merchandise + shipping", () => {
    const q = quoteTotals(100000, 10000);
    expect(q).toEqual({
      shippingPaise: 9900,
      taxPaise: calculateTaxPaise(90000),
      totalPaise: 99900,
    });
    const free = quoteTotals(150000, 0);
    expect(free.shippingPaise).toBe(0);
    expect(free.totalPaise).toBe(150000);
  });
});

describe("checkout persists tax + shipping method (migration 007)", () => {
  it("stores the GST breakout and standard method on the order row", () => {
    const order = mkOrder(2); // 2×50000, below free-shipping threshold
    expect(order.totalPaise).toBe(109900); // unchanged by tax
    expect(order.taxPaise).toBe(calculateTaxPaise(100000));
    const row = getDb()
      .prepare("SELECT tax_paise, shipping_method FROM orders WHERE id=?")
      .get(order.orderId) as { tax_paise: number; shipping_method: string };
    expect(row.tax_paise).toBe(order.taxPaise);
    expect(row.shipping_method).toBe("standard");
  });
  it("deduped replay echoes the stored tax", () => {
    const idem = key();
    const base = {
      name: "T2 Customer", email: "t2@example.com",
      address: "44 T2 Street, Demo City", idempotencyKey: idem,
      items: [{ variantId, quantity: 1 }],
    };
    const first = createDemoOrder(base);
    const replay = createDemoOrder(base);
    expect(replay.deduped).toBe(true);
    expect(replay.taxPaise).toBe(first.taxPaise);
  });
  it("public lookup exposes tax redacted of PII", () => {
    const order = mkOrder(1);
    const pub = getPublicOrder(order.orderId)!;
    expect(pub.tax_paise).toBe(order.taxPaise);
    expect(pub.shipping_method).toBe("standard");
    expect(Object.keys(pub)).not.toEqual(
      expect.arrayContaining(["customer_name", "customer_email", "shipping_address"])
    );
  });
});

describe("order-lookup enumeration hardening", () => {
  it("rejects prefixes shorter than 8 chars (400)", async () => {
    for (const short of ["abc", "ABCD12", "1234567"]) {
      const res = await lookupGET(
        new Request(`http://x/api/orders/lookup?id=${short}`, {
          headers: { "X-Forwarded-For": "198.51.100.31" },
        })
      );
      expect(res.status).toBe(400);
    }
  });
  it("resolves the 8-char confirmation reference (prefix UX kept)", async () => {
    const order = mkOrder(1);
    const prefix = order.orderId.slice(0, 8);
    expect(prefix.length).toBe(8);
    const res = await lookupGET(
      new Request(`http://x/api/orders/lookup?id=${prefix}`, {
        headers: { "X-Forwarded-For": "198.51.100.32" },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { order: { id: string } };
    expect(body.order.id).toBe(order.orderId);
  });
  it("unknown 8-char references share one generic 404 (minimal oracle)", async () => {
    const res = await lookupGET(
      new Request("http://x/api/orders/lookup?id=DEADBEEF", {
        headers: { "X-Forwarded-For": "198.51.100.33" },
      })
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/could not find/i);
    expect(JSON.stringify(body)).not.toMatch(/DEADBEEF/i);
  });
  it("lookup budget is tighter than coupon preview (30/min)", async () => {
    expect(RATE_LIMITS.lookup).toBe(30);
    resetRateLimits();
    const ip = "203.0.113.77";
    let lastStatus = 0;
    let last: Response | null = null;
    for (let i = 0; i < RATE_LIMITS.lookup + 1; i++) {
      last = await lookupGET(
        new Request("http://x/api/orders/lookup?id=DEADBEEF", {
          headers: { "X-Forwarded-For": ip },
        })
      );
      lastStatus = last.status;
    }
    expect(lastStatus).toBe(429);
    expect(last!.headers.get("Retry-After")).toMatch(/^\d+$/);
    resetRateLimits();
  });
});

describe("demo seed stays fenced and claim-free (static guards)", () => {
  const seed = readFileSync(
    path.join(process.cwd(), "scripts", "seed.mjs"), "utf8"
  );
  it("refuses production without an explicit opt-in", () => {
    expect(seed).toContain("ALLOW_DEMO_SEED");
    expect(seed).toContain('NODE_ENV');
  });
  it("labels illustrative copy instead of asserting provenance", () => {
    expect(seed).toMatch(/illustrative|demo|unverified/i);
  });
  it("fabricates no reviews, scarcity, certifications or shipping promises", () => {
    const banned = [
      /certified/i, /organic\b/i, /fair-?trade/i, /award/i,
      /only \d+ left/i, /hurry/i, /selling fast/i,
      /free shipping/i, /guaranteed delivery/i, /overnight/i,
      /★★|⭐|\b5-star/i, /customer review/i, /verified buyer/i,
    ];
    for (const re of banned) expect(seed).not.toMatch(re);
  });
  it("never invents a gateway, carrier or tracking integration", () => {
    expect(seed).not.toMatch(/razorpay|stripe|carrier|tracking number|shipped/i);
  });
});
