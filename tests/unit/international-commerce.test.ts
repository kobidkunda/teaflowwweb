process.env.INTERNATIONAL_RATE_URL = "https://shipping.example.invalid/rate";
process.env.INTERNATIONAL_BOOKING_URL = "https://shipping.example.invalid/book";
process.env.LANDED_COST_URL = "https://shipping.example.invalid/landed";
process.env.COMMERCE_WORKER_SECRET = "isolated-worker-test-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";
import { randomUUID, createHmac } from "node:crypto";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import { upsertProduct } from "@/lib/products";
import { productSchema, normalizeProductInput } from "@/lib/validation";
import { marketSchema, packageSchema, quoteSchema } from "@/lib/international/models";
import { markets, saveMarket, saveConfig, readiness } from "@/lib/international/store";
import { convertPaise, currencyDigits } from "@/lib/international/money";
import { createQuote, getQuote, hash } from "@/lib/international/quotes";
import { startPayment, applyPaymentEvent, liveOrder, releaseExpired, guestToken, validGuestToken, refundOrder } from "@/lib/international/orders";
import { up as migrateInternational } from "../../scripts/migrations/031_international_commerce.mjs";
import { verifySignature, shippingCountries, shippingRate, razorpay } from "@/lib/international/providers";
import { rateFor, refreshFx } from "@/lib/international/fx";
import { queueTranslation, editTranslation, publishedTexts, sourceFor, translation, localize, validateTexts } from "@/lib/international/translations";
import { reconcileCod, cancelUnpaid, bookShipment } from "@/lib/international/fulfillment";
import { POST as adminPOST, GET as adminGET } from "@/app/api/admin/international/[action]/route";
import { POST as webhook } from "@/app/api/webhooks/razorpay/route";
import { POST as commercePOST } from "@/app/api/commerce/[action]/route";
import { activeCampaign, campaignSchema } from "@/lib/international/campaigns";

describe("International commerce", () => {
  let env: TestEnv, cookie: string, variant: number, product: number;
  const session = randomUUID();
  const oldEnv = { ...process.env };
  let remote = 0;
  beforeAll(() => {
    env = setupAdminTestEnv(); cookie = getAuthCookie(env.db);
    Object.assign(process.env, { RAZORPAY_KEY_ID: "rzp_test_local", RAZORPAY_KEY_SECRET: "test_secret", RAZORPAY_WEBHOOK_SECRET: "test_webhook_secret", SHIPROCKET_EMAIL: "test@example.invalid", SHIPROCKET_PASSWORD: "test_password", INTERNATIONAL_RATE_URL: "https://shipping.example.invalid/rate", LANDED_COST_URL: "https://shipping.example.invalid/landed" });
    saveConfig("package", packageSchema.parse({ pickupPostcode: "734015", pickupLocation: "Test", length: 20, breadth: 15, height: 10, tareGrams: 100, maxGrams: 5000, hsn: "090230", origin: "IN" }));
    const m = markets().find(m => m.code === "IN")!;
    const { version: _v, ...india } = m;
    saveMarket({ ...india, enabled: true, covered: true, taxApproved: true, taxPercent: 5, cod: { ...india.cod, enabled: true, postcodes: ["734005"] } }, "test");
    product = upsertProduct(productSchema.parse(normalizeProductInput({ slug: "international-test-tea", name: "Test Tea", status: "published" }))).id;
    variant = Number(env.db.prepare("INSERT INTO variants (product_id,sku,grams,price_paise,stock) VALUES (?,?,?,?,?)").run(product, "INT-100", 100, 50000, 100).lastInsertRowid);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  afterAll(() => { env.cleanup(); process.env = oldEnv; });
  function mockProviders() {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("auth/login")) return Response.json({ token: "test-token" });
      if (url.includes("courier/serviceability")) return Response.json({ data: { available_courier_companies: [{ courier_company_id: 1, rate: 120, cod: 1 }] } });
      if (url.includes("shipping.example.invalid/rate")) return Response.json({ id: "intl-1", costPaise: 25000, expires: Date.now() + 600000, cod: false, ddp: JSON.parse(String(init?.body)).duties === "included" });
      if (url.includes("shipping.example.invalid/landed")) return Response.json({ dutiesPaise: 12000, expires: Date.now() + 300000, ddp: true });
      if (url.endsWith("/orders")) { const b = JSON.parse(String(init?.body)); return Response.json({ id: `order_test${++remote}`, amount: b.amount, currency: b.currency }); }
      if (url.includes("/refund")) return Response.json({ id: `rfnd_test${++remote}` });
      if (url.includes("orders/create/adhoc")) return Response.json({ order_id: 1, shipment_id: 2 });
      throw new Error(`Unexpected test provider ${url}`);
    }));
  }
  const input = (extra: Record<string, unknown> = {}) => ({ address: { name: "Test Buyer", email: "test@example.invalid", phone: "+917001304853", line1: "Synthetic test street", line2: "", city: "Siliguri", state: "West Bengal", postcode: "734005", country: "IN" }, currency: "INR", locale: "en", method: "prepaid", coupon: "", items: [{ variantId: variant, quantity: 1 }], ...extra });
  const capture = (o: ReturnType<typeof liveOrder>, amount?: number, currency?: string) => { const q = JSON.parse(o.document); return { event: "payment.captured", payload: { payment: { entity: { id: `pay_${o.id.replaceAll("-", "")}`, order_id: o.gateway_order_id, amount: amount ?? q.totalMinor, currency: currency ?? q.currency, status: "captured" } } } }; };
  it("handles zero, two, and three decimal currencies exactly", () => {
    expect(currencyDigits("JPY")).toBe(0); expect(currencyDigits("BHD")).toBe(3);
    expect(convertPaise(10000, "1", "INR")).toBe(10000);
    expect(convertPaise(10000, "1.8", "JPY")).toBe(180);
    expect(convertPaise(10000, "0.0045", "BHD")).toBe(450);
    expect(convertPaise(10000, "0.012", "USD", 100, 5)).toBe(120);
    expect(() => convertPaise(-1, "1", "USD")).toThrow();
    expect(() => convertPaise(1, "NaN", "USD")).toThrow();
  });
  it("validates structured addresses and rejects client-supplied prices", () => {
    expect(quoteSchema.safeParse(input({ totalMinor: 1 })).success).toBe(false);
    expect(quoteSchema.safeParse(input({ address: { ...input().address, postcode: "abc" } })).success).toBe(false);
  });
  it("requires readiness before enabling a market", () => {
    expect(() => saveMarket(marketSchema.parse({ code: "US", name: "United States", enabled: true }), "test")).toThrow();
    expect(readiness(marketSchema.parse({ code: "US", name: "United States" })).length).toBeGreaterThan(0);
  });
  it("quotes authoritative India amounts and expires on rule changes", async () => {
    mockProviders(); const q = await createQuote(input(), session);
    expect(q.subtotalPaise).toBe(50000); expect(q.shippingPaise).toBe(9900); expect(q.totalMinor).toBe(59900);
    expect(Object.values(q.components).reduce((a, b) => a + b, 0)).toBe(q.totalMinor);
    expect(() => getQuote(q.id, randomUUID())).toThrow();
    env.db.prepare("UPDATE commerce_markets SET version=version+1 WHERE code='IN'").run();
    expect(() => getQuote(q.id, session)).toThrow();
  });
  it("rejects unavailable destination, stock, postcodes, and currencies", async () => {
    mockProviders();
    await expect(createQuote(input({ currency: "USD" }), session)).rejects.toThrow("currency");
    await expect(createQuote(input({ items: [{ variantId: 999999, quantity: 1 }] }), session)).rejects.toThrow();
    await expect(createQuote(input({ address: { ...input().address, country: "ZZ" } }), session)).rejects.toThrow();
  });
  it("creates one gateway order and reserves stock once on concurrent retries", async () => {
    mockProviders(); const q = await createQuote(input(), session), key = randomUUID();
    const before = (env.db.prepare("SELECT stock FROM variants WHERE id=?").get(variant) as { stock: number }).stock;
    const results = await Promise.allSettled([startPayment(q.id, session, key), startPayment(q.id, session, key)]);
    const first = results.find(r => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof startPayment>>>;
    expect(first.value.gatewayOrderId).toMatch(/^order_/);
    const again = await startPayment(q.id, session, key);
    expect(again.orderId).toBe(first.value.orderId);
    expect((env.db.prepare("SELECT stock FROM variants WHERE id=?").get(variant) as { stock: number }).stock).toBe(before - 1);
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(c => String(c[0]).endsWith("/orders")); expect(calls).toHaveLength(1);
    await expect(startPayment(q.id, randomUUID(), key)).rejects.toThrow();
  });
  it("rejects amount/currency mismatch and handles duplicate capture without stock changes", async () => {
    mockProviders(); const q = await createQuote(input(), session), p = await startPayment(q.id, session, randomUUID()), row = liveOrder(p.orderId);
    expect(() => applyPaymentEvent(randomUUID(), capture(row, 1))).toThrow();
    expect(() => applyPaymentEvent(randomUUID(), capture(row, undefined, "USD"))).toThrow();
    const before = env.db.prepare("SELECT stock FROM variants WHERE id=?").get(variant);
    applyPaymentEvent("capture-once", capture(row)); applyPaymentEvent("capture-once", capture(row)); applyPaymentEvent("capture-again", capture(row));
    expect(liveOrder(row.id).payment_status).toBe("paid");
    expect(env.db.prepare("SELECT stock FROM variants WHERE id=?").get(variant)).toEqual(before);
    const failed = capture(row); failed.event = "payment.failed"; failed.payload.payment.entity.status = "failed";
    applyPaymentEvent(randomUUID(), failed); expect(liveOrder(row.id).payment_status).toBe("paid");
  });
  it("releases expired reservations once and records late capture as paid exception", async () => {
    mockProviders(); const q = await createQuote(input(), session), p = await startPayment(q.id, session, randomUUID()), row = liveOrder(p.orderId);
    env.db.prepare("UPDATE commerce_orders SET reserved_until=0 WHERE id=?").run(row.id);
    releaseExpired(); const before = env.db.prepare("SELECT stock FROM variants WHERE id=?").get(variant); releaseExpired();
    expect(env.db.prepare("SELECT stock FROM variants WHERE id=?").get(variant)).toEqual(before);
    applyPaymentEvent(randomUUID(), capture(row)); expect(liveOrder(row.id).payment_status).toBe("paid_exception");
  });
  it("makes unknown gateway creation uncertain without repeating the remote write", async () => {
    mockProviders(); const q = await createQuote(input(), session); const key = randomUUID();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout"); }));
    await expect(startPayment(q.id, session, key)).rejects.toThrow("verification");
    await expect(startPayment(q.id, session, key)).rejects.toThrow("verified");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("validates raw-body HMACs and guest order access", () => {
    const raw = '{"amount":1}', secret = "secret", sig = createHmac("sha256", secret).update(raw).digest("hex");
    expect(verifySignature(raw, sig, secret)).toBe(true); expect(verifySignature(raw + " ", sig, secret)).toBe(false); expect(verifySignature(raw, "invalid", secret)).toBe(false);
    const id = randomUUID(), token = guestToken(id); expect(validGuestToken(id, token)).toBe(true); expect(validGuestToken(randomUUID(), token)).toBe(false); expect(validGuestToken(id, guestToken(id, Date.now() - 1))).toBe(false);
  });
  it("checks admin authorization, CSRF and strict schemas", async () => {
    const context = { params: Promise.resolve({ action: "market" }) };
    expect((await adminPOST(new Request("http://localhost/api/admin/international/market", { method: "POST", body: "{}" }), context)).status).toBe(401);
    expect((await adminPOST(new Request("http://localhost/api/admin/international/market", { method: "POST", headers: { Cookie: cookie, Origin: "https://evil.example" }, body: "{}" }), context)).status).toBe(403);
    expect((await adminPOST(new Request("http://localhost/api/admin/international/market", { method: "POST", headers: { Cookie: cookie }, body: "{}" }), context)).status).toBe(400);
    const r = await adminGET(new Request("http://localhost/api/admin/international/markets", { headers: { Cookie: cookie } }), { params: Promise.resolve({ action: "markets" }) });
    expect(r.status).toBe(200); expect(await r.text()).not.toContain("test_password");
  });
  it("rejects forged webhook delivery, durably queues valid delivery once", async () => {
    const payload = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_unknown", order_id: "order_unknown", amount: 1, currency: "INR", status: "failed" } } } });
    expect((await webhook(new Request("http://localhost/api/webhooks/razorpay", { method: "POST", body: payload }))).status).toBe(401);
    const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(payload).digest("hex");
    for (let i = 0; i < 2; i++) expect((await webhook(new Request("http://localhost/api/webhooks/razorpay", { method: "POST", headers: { "x-razorpay-signature": signature, "x-razorpay-event-id": "hook-test" }, body: payload }))).status).toBe(200);
    expect((env.db.prepare("SELECT COUNT(*) AS n FROM commerce_jobs WHERE dedupe_key='razorpay:hook-test'").get() as { n: number }).n).toBe(1);
  });
  it("supports India COD without marking payment captured and reconciles exact remittance", async () => {
    mockProviders(); const q = await createQuote(input({ method: "cod" }), session), p = await startPayment(q.id, session, randomUUID());
    expect(p.paymentStatus).toBe("cod_due"); expect(p.gatewayOrderId).toBeNull();
    expect(() => reconcileCod(p.orderId, 1, "test-remittance", "test")).toThrow();
    reconcileCod(p.orderId, q.totalMinor, "test-remittance", "test"); expect(liveOrder(p.orderId).payment_status).toBe("cod_remitted");
    await expect(createQuote(input({ method: "cod", address: { ...input().address, postcode: "110001" } }), session)).rejects.toThrow();
  });
  it("cancels unpaid orders and returns stock without allowing cancelled COD to book", async () => {
    mockProviders(); const q = await createQuote(input({ method: "cod" }), session), p = await startPayment(q.id, session, randomUUID());
    cancelUnpaid(p.orderId, "test"); releaseExpired(); expect(liveOrder(p.orderId).inventory_status).toBe("released"); await expect(bookShipment(p.orderId, "test")).rejects.toThrow();
  });
  it("uses fresh foreign FX snapshots, supports both duties policies and blocks stale charges", async () => {
    mockProviders(); const now = Date.now();
    env.db.prepare("INSERT INTO commerce_fx (id,document,updated_ms,next_ms) VALUES (?,?,?,?)").run("fx-test", JSON.stringify({ id: "fx-test", rates: { USD: "0.012", INR: "1" }, updated: now, next: now + 600000 }), now, now + 600000);
    saveMarket(marketSchema.parse({ code: "US", name: "United States", enabled: true, covered: true, currency: "USD", approvedCurrencies: ["USD", "INR"], taxApproved: true, exportApproved: true }), "test");
    const request = input({ address: { ...input().address, country: "US", postcode: "10001" }, currency: "USD" });
    const q = await createQuote(request, session); expect(q.totalMinor).toBe(900); expect(q.dutiesPaise).toBe(0);
    const { version: _v, ...us } = markets().find(m => m.code === "US")!; saveMarket({ ...us, duties: "included" }, "test");
    const ddp = await createQuote(request, session); expect(ddp.dutiesPaise).toBe(12000); expect(ddp.totalMinor).toBe(1044);
    env.db.prepare("UPDATE commerce_fx SET document=? WHERE id='fx-test'").run(JSON.stringify({ id: "fx-test", rates: { USD: "0.012" }, updated: now, next: now - 1000 }));
    expect(rateFor("USD").stale).toBe(true); expect(() => rateFor("USD", true)).toThrow();
  });
  it("queues reviewed translations, preserves human edits, and falls back after source changes", () => {
    const resource = `product:${product}`; queueTranslation(resource, "fr"); const row = translation(resource, "fr")!;
    expect(row.published).toBeNull(); expect(publishedTexts(resource, "fr")).toBeNull();
    const source = sourceFor(resource), text = { ...source, name: "Thé de test" };
    editTranslation(row.id, text, "draft"); expect(publishedTexts(resource, "fr")).toBeNull();
    editTranslation(row.id, text, "publish"); expect(localize({ name: "Test Tea" }, resource, "fr").name).toBe("Thé de test");
    env.db.prepare("UPDATE products SET name=? WHERE id=?").run("Updated Test Tea", product); expect(publishedTexts(resource, "fr")).toBeNull();
    expect(() => validateTexts({ x: "100 g TeaFloww" }, { x: "200 g TeaFloww" })).toThrow();
    expect(() => validateTexts({ x: "TeaFloww" }, { x: "<script>TeaFloww</script>" })).toThrow();
    expect(() => validateTexts({ x: "TeaFloww" }, { x: "Another brand" })).toThrow();
    expect(hash(source)).not.toBe(hash(sourceFor(resource)));
  });
  it("keeps campaign targeting and scheduling deterministic", () => {
    const c = campaignSchema.parse({ id: randomUUID(), name: "Test regional", countries: ["IN"], enabled: true, starts: Date.now() - 1000, ends: Date.now() + 100000, priority: 1 });
    env.db.prepare("INSERT INTO commerce_campaigns (id,document) VALUES (?,?)").run(c.id, JSON.stringify(c)); expect(activeCampaign("IN")?.id).toBe(c.id); expect(activeCampaign("US")).toBeNull();
  });
  it("limits refund requests and never restocks on refund confirmation", async () => {
    mockProviders(); const q = await createQuote(input(), session), p = await startPayment(q.id, session, randomUUID());
    applyPaymentEvent(randomUUID(), capture(liveOrder(p.orderId))); const key = randomUUID();
    await refundOrder(p.orderId, 1000, key); await refundOrder(p.orderId, 1000, key);
    await expect(refundOrder(p.orderId, q.totalMinor, randomUUID())).rejects.toThrow();
    const before = env.db.prepare("SELECT stock FROM variants WHERE id=?").get(variant);
    const paymentId = liveOrder(p.orderId).gateway_payment_id;
    applyPaymentEvent(randomUUID(), { event: "refund.processed", payload: { refund: { entity: { id: "rfnd_confirm", payment_id: paymentId, amount: 1000, status: "processed" } } } });
    expect(liveOrder(p.orderId).payment_status).toBe("partially_refunded"); expect(env.db.prepare("SELECT stock FROM variants WHERE id=?").get(variant)).toEqual(before);
  });
  it("rejects cross-origin customer mutations", async () => {
    const r = await commercePOST(new Request("http://localhost/api/commerce/preferences", { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" }), { params: Promise.resolve({ action: "preferences" }) }); expect(r.status).toBe(403);
  });
  it("replays the additive migration without changing operator settings or inventing FX", () => {
    const before = env.db.prepare("SELECT * FROM commerce_markets ORDER BY code").all();
    const pack = env.db.prepare("SELECT document FROM commerce_config WHERE key='package'").get();
    migrateInternational(env.db);
    expect(env.db.prepare("SELECT * FROM commerce_markets ORDER BY code").all()).toEqual(before);
    expect(env.db.prepare("SELECT document FROM commerce_config WHERE key='package'").get()).toEqual(pack);
    expect((env.db.prepare("SELECT COUNT(*) AS n FROM commerce_fx WHERE id='fx-seed-baseline'").get() as { n: number }).n).toBe(0);
  });
  it("never substitutes invented provider values even if a legacy mock flag is present", async () => {
    vi.stubEnv("COMMERCE_MOCK_PROVIDERS", "1");
    for (const key of ["EXCHANGE_RATE_API_KEY", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "SHIPROCKET_EMAIL", "SHIPROCKET_PASSWORD", "SHIPPING_COUNTRIES_URL", "INTERNATIONAL_RATE_URL"]) vi.stubEnv(key, "");
    await expect(refreshFx()).rejects.toThrow("credentials");
    await expect(razorpay("orders", { amount: 100, currency: "INR" })).rejects.toThrow("configured");
    await expect(shippingCountries()).rejects.toThrow("configuration");
    const pack = packageSchema.parse({ pickupPostcode: "734015", pickupLocation: "Test", length: 10, breadth: 10, height: 10, tareGrams: 100, maxGrams: 5000, hsn: "090230", origin: "IN" });
    await expect(shippingRate(quoteSchema.parse(input()), [], pack, false)).rejects.toThrow("configured");
  });
  it("rejects changes to quantitative units during translation review", () => {
    expect(() => validateTexts({ size: "100 g" }, { size: "100 kg" })).toThrow();
  });

  it("requires explicit server-recorded INR acceptance for international payment", async () => {
    mockProviders();
    const q = await createQuote(input({ address: { ...input().address, country: "US", postcode: "10001" }, currency: "INR" }), session);
    const key = randomUUID();
    const send = (consent: Record<string, unknown>) => commercePOST(new Request("http://localhost/api/commerce/payment", { method: "POST", headers: { Cookie: `tf_commerce=${session}`, "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: q.id, idempotencyKey: key, ...consent }) }), { params: Promise.resolve({ action: "payment" }) });
    expect((await send({})).status).toBe(400);
    expect((await send({ currencyAcceptance: "USD", inrAcceptance: true })).status).toBe(409);
    expect((await send({ currencyAcceptance: "INR", inrAcceptance: false })).status).toBe(409);
    expect((await send({ currencyAcceptance: "INR", inrAcceptance: true })).status).toBe(200);
    expect(env.db.prepare("SELECT id FROM commerce_events WHERE id=?").get(`currency-consent:${q.id}`)).toBeTruthy();
  });

  it("removes signed guest tokens from document URLs and excludes private locale rewrites", () => {
    const id = randomUUID(), token = guestToken(id);
    const response = middleware(new NextRequest(`http://localhost/purchase/${id}?token=${token}`));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`http://localhost/purchase/${id}`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain(`Path=/purchase/${id}`);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(middleware(new NextRequest("http://localhost/fr/admin/markets")).status).toBe(404);
    expect(middleware(new NextRequest(`http://localhost/purchase/${id}?token=invalid`)).status).toBe(404);
  });

});
