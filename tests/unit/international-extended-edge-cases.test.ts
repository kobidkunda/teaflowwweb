import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildCanonicalUrl } from "@/lib/seo/canonical";

const TEST_DB = path.join(tmpdir(), `test-edge-cases-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;
process.env.COMMERCE_MOCK_PROVIDERS = "1";
process.env.ORDER_ACCESS_SECRET = "test-secret-edge-cases-1234567890123456";
process.env.SESSION_SECRET = "test-session-secret-1234567890123456";

describe("International Extended Edge Cases & Robustness", () => {
  let db: any;

  beforeAll(async () => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const { getDb } = await import("@/lib/db");
    db = getDb();
  });

  afterAll(() => {
    try { rmSync(TEST_DB, { force: true }); } catch {}
  });

  it("country reference metadata has unique ISO identifiers without asserting account coverage", async () => {
    const { SHIPROCKET_DESTINATIONS, destinationByCode } = await import("@/lib/international/shiprocketDestinations");
    expect(new Set(SHIPROCKET_DESTINATIONS.map(d => d.code)).size).toBe(SHIPROCKET_DESTINATIONS.length);

    const us = destinationByCode("US");
    expect(us).toBeDefined();
    expect(us?.currency).toBe("USD");
    expect(us?.name).toBe("United States");

    const jp = destinationByCode("JP");
    expect(jp?.currency).toBe("JPY");

    const ae = destinationByCode("AE");
    expect(ae?.currency).toBe("AED");
    expect(ae?.language).toBe("ar");

    // All entries have valid 2-letter uppercase ISO codes
    for (const d of SHIPROCKET_DESTINATIONS) {
      expect(d.code).toMatch(/^[A-Z]{2}$/);
      expect(d.currency).toMatch(/^[A-Z]{3}$/);
      expect(d.name.length).toBeGreaterThan(0);
    }
  });

  it("sourceFor correctly queries email_templates table by key and label", async () => {
    const { sourceFor, resourceList } = await import("@/lib/international/translations");
    const list = resourceList();
    const emailRes = list.find((r) => r.resource.startsWith("email:"));
    expect(emailRes).toBeDefined();

    if (emailRes) {
      const src = sourceFor(emailRes.resource);
      expect(src).toBeDefined();
      expect(typeof src.subject).toBe("string");
    }
  });

  it("preserves catalog SKU formats in validateTexts", async () => {
    const { validateTexts } = await import("@/lib/international/translations");
    const source = {
      name: "Assam Golden Breakfast SKU AS-GB-100",
      description: "Packaged in foil pouch 100g at https://teafloww.com/assam",
    };
    const translated = {
      name: "Assam Golden Breakfast SKU AS-GB-100 (हिन्दी)",
      description: "Foil pouch 100g pack at https://teafloww.com/assam",
    };

    expect(() => validateTexts(source, translated)).not.toThrow();

    // Mismatched SKU should fail
    const invalidSku = {
      name: "Assam Golden Breakfast SKU AS-GB-999",
      description: "Packaged in foil pouch 100g at https://teafloww.com/assam",
    };
    expect(() => validateTexts(source, invalidSku)).toThrow("Translation changed protected values or placeholders.");
  });

  it("constructMetadata sets canonical to English and noindex when non-en locale has no published translation", async () => {
    const { constructMetadata } = await import("@/lib/seo/metadata");

    // Homepage has no published 'ja' translation in fresh test DB
    const meta = constructMetadata({
      path: "/",
      locale: "ja",
      resource: "homepage",
      title: "TeaFloww Homepage",
    });

    // Should point canonical to English root and enforce noindex
    expect(meta.alternates?.canonical).toBe(buildCanonicalUrl("/"));
    expect(meta.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it("getPublicOrder and getPublicOrderTrackingItems fallback to commerce_orders when legacy orders does not match", async () => {
    const { getPublicOrder, getPublicOrderTrackingItems } = await import("@/lib/storefront");

    const orderId = "c0ffee00-1111-2222-3333-444455556666";
    const quoteId = "quote-test-123";
    const quoteDoc = {
      id: quoteId,
      subtotalPaise: 150000,
      discountPaise: 0,
      shippingPaise: 9900,
      taxPaise: 0,
      totalPaise: 159900,
      currency: "INR",
      rate: "1",
      carrier: "fedex_surface",
      input: {
        address: {
          name: "Test User",
          email: "test@example.com",
          country: "IN",
          city: "Siliguri",
          state: "West Bengal",
          postcode: "734005",
          line1: "123 Tea Road",
          phone: "+919876543210",
        },
        currency: "INR",
        locale: "en",
        method: "prepaid",
        coupon: "",
        items: [{ variantId: 101, quantity: 1 }],
      },
      lines: [
        {
          sku: "AS-GB-100",
          variantId: 101,
          name: "Assam Golden Breakfast",
          pricePaise: 150000,
          quantity: 1,
        },
      ],
    };

    // Insert quote first to satisfy foreign key
    db.prepare(
      "INSERT INTO commerce_quotes (id, owner, document, expires_ms) VALUES (?, ?, ?, ?)"
    ).run(quoteId, "session-1", JSON.stringify(quoteDoc), Date.now() + 600000);

    db.prepare(
      "INSERT INTO commerce_orders (id, owner, idempotency_key, quote_id, document, payment_status, fulfillment_status, reserved_until, created_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      orderId,
      "session-1",
      "idemp-1",
      quoteId,
      JSON.stringify(quoteDoc),
      "paid",
      "preparing",
      Date.now() + 60000,
      Date.now()
    );

    // Live orders and their line items fallback to commerce_orders
    const order = getPublicOrder(orderId);
    expect(order).not.toBeNull();
    expect(order?.id).toBe(orderId);
    expect(order?.total_paise).toBe(159900);

    const prefixOrder = getPublicOrder("c0ffee00");
    expect(prefixOrder).not.toBeNull();
    expect(prefixOrder?.id).toBe(orderId);

    const items = getPublicOrderTrackingItems(orderId);
    expect(items.length).toBe(1);
    expect(items[0].item_id).toBe("AS-GB-100");
  });

  it("handles email jobs gracefully without throwing when SMTP is unconfigured", async () => {
    const { processOneJob } = await import("@/lib/international/jobs");
    const { enqueue } = await import("@/lib/international/store");

    const orderId = "c0ffee00-1111-2222-3333-444455556666";
    delete process.env.SMTP_HOST; // Ensure SMTP is unconfigured

    enqueue("email", { orderId, template: "order_confirmation" }, `email:test:${orderId}`);

    // Processing the job should not throw an unhandled error and should succeed gracefully
    const ran = await processOneJob();
    expect(ran).toBe(true);

    const job = db.prepare("SELECT status, error FROM commerce_jobs WHERE dedupe_key LIKE 'email:test:%'").get() as { status: string; error: string | null };
    expect(job).toBeDefined();
    expect(job.status).toBe("queued");
    expect(job.error).toContain("Email delivery");

    // Cleanup
    db.prepare("DELETE FROM commerce_jobs WHERE dedupe_key LIKE 'email:test:%'").run();
    db.prepare("DELETE FROM commerce_orders WHERE id = ?").run(orderId);
    db.prepare("DELETE FROM commerce_quotes WHERE id = ?").run("quote-test-123");
  });

  it("publicMarkets exposes approvedCurrencies list for frontend currency validation", async () => {
    const { publicMarkets } = await import("@/lib/international/store");
    const markets = publicMarkets();
    expect(markets.length).toBeGreaterThan(0);
    const inMarket = markets.find(m => m.code === "IN");
    expect(inMarket).toBeDefined();
    expect(Array.isArray(inMarket?.approvedCurrencies)).toBe(true);
    expect(inMarket?.approvedCurrencies).toContain("INR");
  });

  it("rateFor and requestContext correctly distinguish fresh payment vs 48h stale browsing estimates", async () => {
    const { rateFor } = await import("@/lib/international/fx");
    const { requestContext } = await import("@/lib/international/context");

    // Insert an overdue FX snapshot (next was 2 hours ago, but within 48h)
    const now = Date.now();
    const overdueNext = now - 2 * 3600000;
    const overdueUpdated = now - 26 * 3600000;

    db.prepare("DELETE FROM commerce_fx").run();
    db.prepare("INSERT INTO commerce_fx (id, document, updated_ms, next_ms) VALUES (?, ?, ?, ?)").run(
      "fx-overdue-1",
      JSON.stringify({
        id: "fx-overdue-1",
        rates: { USD: "0.012", EUR: "0.011" },
        updated: overdueUpdated,
        next: overdueNext,
      }),
      overdueUpdated,
      overdueNext
    );

    // Browsing (payment = false): allowed with stale = true
    const browsing = rateFor("USD", false);
    expect(browsing.rate).toBe("0.012");
    expect(browsing.stale).toBe(true);

    // Payment (payment = true): strictly rejected because rate is overdue
    expect(() => rateFor("USD", true)).toThrow("A current exchange rate is unavailable. Please choose INR or retry shortly.");

    // requestContext sets rateStale: true
    const ctx = await requestContext();
    expect(ctx.rates["USD"]).toBe("0.012");
    expect(ctx.rateStale).toBe(true);

    // After 49 hours (beyond 48h browsing window): browsing also rejected
    const ancientNext = now - 50 * 3600000;
    db.prepare("DELETE FROM commerce_fx").run();
    db.prepare("INSERT INTO commerce_fx (id, document, updated_ms, next_ms) VALUES (?, ?, ?, ?)").run(
      "fx-ancient-1",
      JSON.stringify({
        id: "fx-ancient-1",
        rates: { USD: "0.012" },
        updated: ancientNext - 24 * 3600000,
        next: ancientNext,
      }),
      ancientNext - 24 * 3600000,
      ancientNext
    );
    expect(() => rateFor("USD", false)).toThrow("A current exchange rate is unavailable");

    // and requestContext falls back to INR only
    const ancientCtx = await requestContext();
    expect(ancientCtx.rates).toEqual({ INR: "1" });
  });

  it("studio attaches jobId to resources for queued or failed translation jobs", async () => {
    const { queueTranslation, studio } = await import("@/lib/international/translations");
    const jobId = queueTranslation("interface", "hi");
    expect(jobId).toBeDefined();

    const items = studio("hi");
    const interfaceItem = items.find(r => r.resource === "interface");
    expect(interfaceItem).toBeDefined();
    expect(interfaceItem?.jobId).toBe(jobId);
  });

  it("GET /api/admin/international/markets includes fxJob, audit, and fx freshness", async () => {
    const { GET } = await import("@/app/api/admin/international/[action]/route");
    const { createAdminSession, SESSION_COOKIE } = await import("@/lib/adminSessions");

    db.prepare("INSERT OR IGNORE INTO admin_users (id, username, email, password_hash, role, is_active) VALUES (1, 'admin', 'admin@teafloww.com', 'hash', 'admin', 1)").run();
    const { cookieValue } = createAdminSession(1);
    const req = new Request("http://localhost:3000/api/admin/international/markets", {
      headers: {
        Cookie: `${SESSION_COOKIE}=${cookieValue}`,
      },
    });

    const res = await GET(req, { params: Promise.resolve({ action: "markets" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.markets).toBeDefined();
    expect(Array.isArray(body.audit)).toBe(true);
    expect(body.fx).toBeDefined();
    expect(body.status).toBeDefined();
  });

  it("GET /api/admin/international/translations returns revision history when translationId is supplied", async () => {
    const { GET } = await import("@/app/api/admin/international/[action]/route");
    const { createAdminSession, SESSION_COOKIE } = await import("@/lib/adminSessions");
    const { editTranslation, translation, sourceFor } = await import("@/lib/international/translations");

    const trans = translation("interface", "hi");
    expect(trans).toBeDefined();
    if (trans) {
      // Record a draft edit to produce a history record
      editTranslation(trans.id, sourceFor("interface"), "draft");

      db.prepare("INSERT OR IGNORE INTO admin_users (id, username, email, password_hash, role, is_active) VALUES (1, 'admin', 'admin@teafloww.com', 'hash', 'admin', 1)").run();
      const { cookieValue } = createAdminSession(1);
      const req = new Request(`http://localhost:3000/api/admin/international/translations?locale=hi&translationId=${trans.id}`, {
        headers: {
          Cookie: `${SESSION_COOKIE}=${cookieValue}`,
        },
      });

      const res = await GET(req, { params: Promise.resolve({ action: "translations" }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.history)).toBe(true);
      expect(body.history.length).toBeGreaterThanOrEqual(1);
    }
  });
});
