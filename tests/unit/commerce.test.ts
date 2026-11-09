import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

// Commerce-integrity verification (t3): verified-webhook-only paid flow,
// atomic stock capture, coupon capture-time guards, state machines,
// idempotency replays. Isolated temp DB migrated fresh; never touches dev data.
const TEST_DB = path.join(tmpdir(), `commerce-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

const SECRET = "commerce-test-webhook-secret-0123456789";

const { createDemoOrder, CheckoutError } = await import("../../src/lib/checkout");
const { recordPaymentIntent, applyWebhook, webhookSignature, PaymentError } = await import("../../src/lib/payments");
const { getOrder, setDispatchStatusTx, cancelOrder, OrderTransitionError } = await import("../../src/lib/orders");
const { getDb } = await import("../../src/lib/db");
const { upsertProduct } = await import("../../src/lib/products");
const { upsertVariant } = await import("../../src/lib/products");
const { upsertCoupon, quoteCoupon } = await import("../../src/lib/coupons");
const { POST: checkoutPOST } = await import("../../src/app/api/checkout/route");
const { POST: webhookPOST } = await import("../../src/app/api/payments/webhook/route");

let variantId = 0;
let keySeq = 0;
const key = () => {
  keySeq += 1;
  const tail = String(keySeq).padStart(12, "0");
  return `12345678-1234-4234-8234-${tail}`;
};
const checkoutInput = (variantQty: number, couponCode?: string, idem?: string) => ({
  name: "Commerce Tester",
  email: "commerce@example.com",
  address: "44 Commerce Street, Demo City",
  idempotencyKey: idem ?? key(),
  ...(couponCode ? { couponCode } : {}),
  items: [{ variantId, quantity: variantQty }],
});
const sign = (gwId: string, status: string) => webhookSignature(SECRET, gwId, status);
const stockOf = () =>
  (getDb().prepare("SELECT stock FROM variants WHERE id=?").get(variantId) as { stock: number }).stock;
const usedOf = (code: string) =>
  (getDb().prepare("SELECT used_count FROM coupons WHERE code=?").get(code) as { used_count: number }).used_count;
const paymentStatusOf = (orderId: string) => getOrder(orderId)!.payment_status;

beforeAll(() => {
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET;
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: TEST_DB },
    stdio: "ignore",
  });
  const product = upsertProduct({
    slug: "commerce-tea", name: "Commerce Tea", category: "Black",
    origin: "Test origin", estate: "Test estate", flush: "Spring",
    harvest_date: "2026 harvest", description: "Commerce test tea.",
    tasting_notes: "Malty", floral: 1, fruity: 1, malty: 5, body: 4,
    brew_temp: 90, brew_seconds: 180, featured: 0,
  });
  const variant = upsertVariant({
    product_id: product.id, sku: "COM-T-100", grams: 100, price_paise: 50000, stock: 5,
  });
  variantId = variant.id;
  upsertCoupon({ code: "ONEUSE", kind: "percent", value: 10, max_uses: 1, min_subtotal_paise: 0, is_active: 1 });
});

afterAll(() => {
  delete process.env.PAYMENT_WEBHOOK_SECRET;
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    try { rmSync(TEST_DB + suffix, { force: true }); } catch { /* ignore */ }
  }
});

describe("webhook gate: no paid without verification", () => {
  it("rejects every webhook without a gateway secret", () => {
    const saved = process.env.PAYMENT_WEBHOOK_SECRET;
    delete process.env.PAYMENT_WEBHOOK_SECRET;
    try {
      expect(applyWebhook({ gatewayPaymentId: "pay-x", status: "paid", signature: "00" }).ok).toBe(false);
    } finally {
      process.env.PAYMENT_WEBHOOK_SECRET = saved;
    }
  });
  it("rejects forged signatures and leaves order + stock untouched", () => {
    const order = createDemoOrder(checkoutInput(2));
    const intent = recordPaymentIntent(order.orderId, order.totalPaise, key(), "razorpay", "pay-forge-1");
    expect(intent.payment.status).toBe("payment_pending");
    const res = applyWebhook({ gatewayPaymentId: "pay-forge-1", status: "paid", signature: "deadbeef" });
    expect(res.ok).toBe(false);
    expect(paymentStatusOf(order.orderId)).toBe("payment_pending");
    expect(stockOf()).toBe(5);
  });
  it("rejects unknown payments and unknown statuses after a valid signature", () => {
    const res = applyWebhook({ gatewayPaymentId: "pay-nope", status: "paid", signature: sign("pay-nope", "paid") });
    expect(res).toMatchObject({ ok: false });
    const order = createDemoOrder(checkoutInput(1));
    recordPaymentIntent(order.orderId, order.totalPaise, key(), "razorpay", "pay-odd-1");
    const res2 = applyWebhook({ gatewayPaymentId: "pay-odd-1", status: "teleport", signature: sign("pay-odd-1", "teleport") });
    expect(res2).toMatchObject({ ok: false });
    expect(paymentStatusOf(order.orderId)).toBe("payment_pending");
    expect(stockOf()).toBe(5);
  });
  it("rejects intents whose amount differs from the server total", () => {
    const order = createDemoOrder(checkoutInput(1));
    expect(() => recordPaymentIntent(order.orderId, order.totalPaise - 1, key(), "razorpay", "pay-short")).toThrow(PaymentError);
  });
});

describe("verified capture: paid + atomic stock decrement", () => {
  const gwId = "pay-happy-1";
  let orderId = "";
  let total = 0;
  it("captures: test-mode charge → verified webhook → paid, stock decremented once", () => {
    const order = createDemoOrder(checkoutInput(2));
    orderId = order.orderId;
    total = order.totalPaise;
    expect(total).toBe(109900); // 2×50000 + 9900 shipping
    recordPaymentIntent(orderId, total, key(), "razorpay", gwId);
    const res = applyWebhook({ gatewayPaymentId: gwId, status: "paid", signature: sign(gwId, "paid") });
    expect(res).toMatchObject({ ok: true });
    expect(paymentStatusOf(orderId)).toBe("paid");
    expect(stockOf()).toBe(3);
    const events = getDb().prepare("SELECT to_status FROM payment_events WHERE order_id=? ORDER BY id").all(orderId) as { to_status: string }[];
    expect(events.map((e) => e.to_status)).toEqual(["payment_pending", "paid"]);
  });
  it("dedupes double webhooks: no second decrement", () => {
    const replay = applyWebhook({ gatewayPaymentId: gwId, status: "paid", signature: sign(gwId, "paid") });
    expect(replay).toMatchObject({ ok: true, deduped: true });
    expect(stockOf()).toBe(3);
    expect(paymentStatusOf(orderId)).toBe("paid");
  });
  it("refunds: refunded + stock restored + gateway record updated", () => {
    const res = applyWebhook({ gatewayPaymentId: gwId, status: "refunded", signature: sign(gwId, "refunded") });
    expect(res).toMatchObject({ ok: true });
    expect(paymentStatusOf(orderId)).toBe("refunded");
    expect(stockOf()).toBe(5);
    const row = getDb().prepare("SELECT status FROM order_payments WHERE gateway_payment_id=?").get(gwId) as { status: string };
    expect(row.status).toBe("refunded");
  });
});

describe("demo path fenced from prod", () => {
  it("demo intents without a gateway id are unreachable by webhooks", () => {
    const order = createDemoOrder(checkoutInput(1));
    recordPaymentIntent(order.orderId, order.totalPaise, key()); // gateway defaults to demo
    const res = applyWebhook({ gatewayPaymentId: "pay-demo-ghost", status: "paid", signature: sign("pay-demo-ghost", "paid") });
    expect(res.ok).toBe(false);
    expect(paymentStatusOf(order.orderId)).toBe("payment_pending");
  });
  it("demo-gateway records are rejected even with a linked id + valid signature", () => {
    const order = createDemoOrder(checkoutInput(1));
    recordPaymentIntent(order.orderId, order.totalPaise, key(), "demo", "demo-link-1");
    const res = applyWebhook({ gatewayPaymentId: "demo-link-1", status: "paid", signature: sign("demo-link-1", "paid") });
    expect(res.ok).toBe(false);
    expect(paymentStatusOf(order.orderId)).toBe("payment_pending");
    expect(stockOf()).toBe(5);
  });
});

describe("oversell: concurrent checkouts cannot both capture", () => {
  it("second capture fails closed to payment_failed with stock intact", () => {
    const a = createDemoOrder(checkoutInput(2)); // stock gate passes at 5
    const b = createDemoOrder(checkoutInput(4)); // stock gate passes at 5
    expect(b.totalPaise).toBe(200000); // 4×50000, free shipping
    recordPaymentIntent(a.orderId, a.totalPaise, key(), "razorpay", "pay-race-a");
    recordPaymentIntent(b.orderId, b.totalPaise, key(), "razorpay", "pay-race-b");
    expect(applyWebhook({ gatewayPaymentId: "pay-race-a", status: "paid", signature: sign("pay-race-a", "paid") })).toMatchObject({ ok: true });
    expect(stockOf()).toBe(3);
    const failed = applyWebhook({ gatewayPaymentId: "pay-race-b", status: "paid", signature: sign("pay-race-b", "paid") });
    expect(failed.ok).toBe(false);
    expect(paymentStatusOf(b.orderId)).toBe("payment_failed");
    expect(stockOf()).toBe(3);
  });
});

describe("coupon abuse guards: counted at capture, raced safely", () => {
  it("two checkouts share one single-use code; only the first capture wins", () => {
    const c = createDemoOrder(checkoutInput(1, "ONEUSE"));
    const d = createDemoOrder(checkoutInput(1, "oneuse"));
    expect(c.discountPaise).toBe(5000);
    expect(usedOf("ONEUSE")).toBe(0); // checkout never burns limited codes
    recordPaymentIntent(c.orderId, c.totalPaise, key(), "razorpay", "pay-coupon-c");
    recordPaymentIntent(d.orderId, d.totalPaise, key(), "razorpay", "pay-coupon-d");
    expect(applyWebhook({ gatewayPaymentId: "pay-coupon-c", status: "paid", signature: sign("pay-coupon-c", "paid") })).toMatchObject({ ok: true });
    expect(usedOf("ONEUSE")).toBe(1);
    const loser = applyWebhook({ gatewayPaymentId: "pay-coupon-d", status: "paid", signature: sign("pay-coupon-d", "paid") });
    expect(loser.ok).toBe(false);
    expect(paymentStatusOf(d.orderId)).toBe("payment_failed");
    expect(quoteCoupon("ONEUSE", 50000).valid).toBe(false);
    expect(() => createDemoOrder(checkoutInput(1, "ONEUSE"))).toThrow(CheckoutError);
  });
  it("refunding the winning capture releases the coupon", () => {
    const cId = (getDb().prepare("SELECT order_id AS id FROM order_payments WHERE gateway_payment_id=?").get("pay-coupon-c") as { id: string }).id;
    expect(applyWebhook({ gatewayPaymentId: "pay-coupon-c", status: "refunded", signature: sign("pay-coupon-c", "refunded") })).toMatchObject({ ok: true });
    expect(paymentStatusOf(cId)).toBe("refunded");
    expect(usedOf("ONEUSE")).toBe(0);
    const e = createDemoOrder(checkoutInput(1, "ONEUSE")); // usable again
    expect(e.discountPaise).toBe(5000);
  });
});

describe("idempotency replays return the original row", () => {
  it("checkout replay echoes the same order", () => {
    const idem = key();
    const first = createDemoOrder(checkoutInput(1, undefined, idem));
    const replay = createDemoOrder(checkoutInput(1, undefined, idem));
    expect(replay).toMatchObject({ orderId: first.orderId, deduped: true });
    expect(first.deduped).toBe(false);
  });
  it("payment-intent replay echoes the same payment", () => {
    const order = createDemoOrder(checkoutInput(1));
    const idem = key();
    const first = recordPaymentIntent(order.orderId, order.totalPaise, idem, "razorpay", "pay-idem-1");
    const replay = recordPaymentIntent(order.orderId, order.totalPaise, idem, "razorpay", "pay-idem-1");
    expect(first.deduped).toBe(false);
    expect(replay.deduped).toBe(true);
    expect(replay.payment.id).toBe(first.payment.id);
  });
  it("dispatch replay echoes the same order", () => {
    const order = createDemoOrder(checkoutInput(1));
    const idem = key();
    const first = setDispatchStatusTx({ orderId: order.orderId, to: "preparing", idempotencyKey: idem });
    const replay = setDispatchStatusTx({ orderId: order.orderId, to: "preparing", idempotencyKey: idem });
    expect(first.deduped).toBe(false);
    expect(replay).toMatchObject({ deduped: true });
    expect(replay.order.id).toBe(order.orderId);
  });
});

describe("order state machine enforcement", () => {
  it("unpaid orders prepare but never ship; paid orders ship and deliver", () => {
    const order = createDemoOrder(checkoutInput(1));
    const tx = setDispatchStatusTx({ orderId: order.orderId, to: "preparing" });
    expect(tx.order.dispatch_status).toBe("preparing");
    expect(() => setDispatchStatusTx({ orderId: order.orderId, to: "shipped" }).order).toThrow(OrderTransitionError);
    expect(() => setDispatchStatusTx({ orderId: order.orderId, to: "delivered" }).order).toThrow(OrderTransitionError);
    recordPaymentIntent(order.orderId, tx.order.total_paise, key(), "razorpay", "pay-ship-1");
    expect(applyWebhook({ gatewayPaymentId: "pay-ship-1", status: "paid", signature: sign("pay-ship-1", "paid") })).toMatchObject({ ok: true });
    expect(setDispatchStatusTx({ orderId: order.orderId, to: "shipped" }).order.dispatch_status).toBe("shipped");
    expect(setDispatchStatusTx({ orderId: order.orderId, to: "delivered" }).order.dispatch_status).toBe("delivered");
  });
  it("paid orders cannot be cancelled — they must be refunded", () => {
    const order = createDemoOrder(checkoutInput(1));
    recordPaymentIntent(order.orderId, order.totalPaise, key(), "razorpay", "pay-nocancel-1");
    expect(applyWebhook({ gatewayPaymentId: "pay-nocancel-1", status: "paid", signature: sign("pay-nocancel-1", "paid") })).toMatchObject({ ok: true });
    setDispatchStatusTx({ orderId: order.orderId, to: "preparing" });
    expect(() => cancelOrder(order.orderId)).toThrow(/refund/i);
    expect(() => setDispatchStatusTx({ orderId: order.orderId, to: "cancelled" }).order).toThrow(/refund/i);
  });
  it("unpaid orders cancel normally", () => {
    const order = createDemoOrder(checkoutInput(1));
    expect(cancelOrder(order.orderId).dispatch_status).toBe("cancelled");
  });
});

describe("route behaviour", () => {
  it("checkout replay returns 200 + deduped (fresh returns 201)", async () => {
    const idem = key();
    const body = {
      name: "Route Tester", email: "route@example.com", address: "7 Route Lane, Demo City",
      idempotencyKey: idem, items: [{ variantId, quantity: 1 }],
    };
    const mk = (fwd: string) =>
      new Request("http://x/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": fwd },
        body: JSON.stringify(body),
      });
    const fresh = await checkoutPOST(mk("10.9.0.1"));
    expect(fresh.status).toBe(201);
    const replay = await checkoutPOST(mk("10.9.0.2"));
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ deduped: true });
  });
  it("webhook route hides config/signature failures as generic 401", async () => {
    const bad = await webhookPOST(
      new Request("http://x/api/payments/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayPaymentId: "pay-forge-1", status: "paid", signature: "00" }),
      })
    );
    expect(bad.status).toBe(401);
    const body = (await bad.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(JSON.stringify(body)).not.toContain(" signature");
  });
});
