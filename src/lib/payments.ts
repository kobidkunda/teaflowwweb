import { randomUUID, timingSafeEqual, createHmac } from "node:crypto";
import { getDb } from "@/lib/db";
export type OrderPayment = { id: string; order_id: string; gateway: string; gateway_payment_id: string | null; amount_paise: number; status: string; idempotency_key: string; created_at: string };
export class PaymentError extends Error {}
export type WebhookResult = { ok: boolean; reason?: string; deduped?: boolean };

// Payment state machine (service-enforced, single SQL owner).
// Only a verified gateway webhook advances an order toward paid/refunded.
// Demo records (gateway 'demo', no gateway_payment_id link) can never reach paid.
const PAYMENT_NEXT: Record<string, string[]> = {
  unpaid: ["payment_pending", "payment_failed"],
  payment_pending: ["paid", "payment_failed"],
  payment_failed: ["payment_pending", "paid"],
  paid: ["refunded"],
  refunded: [],
};
const WEBHOOK_TO_PAYMENT: Record<string, string> = {
  paid: "paid",
  payment_failed: "payment_failed",
  refunded: "refunded",
};

/** Canonical webhook signature: HMAC-SHA256(secret, "<gatewayPaymentId>:<status>") hex. Exported for tests/ops drills. */
export function webhookSignature(secret: string, gatewayPaymentId: string, status: string): string {
  return createHmac("sha256", secret).update(gatewayPaymentId + ":" + status).digest("hex");
}

function signatureValid(secret: string, gatewayPaymentId: string, status: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(gatewayPaymentId + ":" + status).digest();
  let got: Buffer;
  try {
    got = Buffer.from((signature || "").trim(), "hex");
  } catch {
    return false;
  }
  return got.length === expected.length && timingSafeEqual(got, expected);
}

type OrderHead = {
  id: string; total_paise: number; payment_status: string;
  coupon_code: string | null; dispatch_status: string;
};

/**
 * Status record for a payment attempt. Never marks an order paid — paid happens
 * exclusively in applyWebhook after signature verification. The intent amount
 * must equal the server-computed order total (no partial/underpay intents).
 * gatewayPaymentId links the later gateway callback; demo intents leave it NULL
 * so no webhook can ever resolve to them.
 */
export function recordPaymentIntent(orderId: string, amountPaise: number, idempotencyKey: string, gateway = "demo", gatewayPaymentId?: string | null): { payment: OrderPayment; deduped: boolean } {
  if (!Number.isInteger(amountPaise) || amountPaise < 0) throw new PaymentError("Invalid amount.");
  const gw = (gateway || "demo").trim().slice(0, 40) || "demo";
  const gwId = (gatewayPaymentId ?? "").trim().slice(0, 200) || null;
  const db = getDb();
  return db.transaction(() => {
    const prior = db.prepare("SELECT * FROM order_payments WHERE idempotency_key=?").get(idempotencyKey) as OrderPayment | undefined;
    if (prior) return { payment: prior, deduped: true };
    const order = db.prepare("SELECT id, total_paise, COALESCE(payment_status,'unpaid') AS payment_status FROM orders WHERE id=?").get(orderId) as OrderHead | undefined;
    if (!order) throw new PaymentError("Order not found.");
    if (gwId) {
      const clash = db.prepare("SELECT id FROM order_payments WHERE gateway_payment_id=?").get(gwId) as { id: string } | undefined;
      if (clash) throw new PaymentError("Payment already recorded.");
    }
    if (amountPaise !== order.total_paise) throw new PaymentError("Amount does not match the order total.");
    const id = randomUUID();
    db.prepare("INSERT INTO order_payments (id, order_id, gateway, gateway_payment_id, amount_paise, status, idempotency_key) VALUES (?,?,?,?,?,?,?)")
      .run(id, orderId, gw, gwId, amountPaise, "payment_pending", idempotencyKey);
    const from = order.payment_status || "unpaid";
    // A fresh attempt re-opens failed orders; paid/refunded orders keep their state
    // (any later webhook for this intent is rejected by the state machine).
    if (from === "unpaid" || from === "payment_failed") {
      db.prepare("UPDATE orders SET payment_status='payment_pending' WHERE id=?").run(orderId);
      db.prepare("INSERT INTO payment_events (order_id, from_status, to_status, actor) VALUES (?,?,?,?)").run(orderId, from, "payment_pending", "system");
    }
    return { payment: db.prepare("SELECT * FROM order_payments WHERE id=?").get(id) as OrderPayment, deduped: false };
  })();
}
export function listPayments(orderId: string): OrderPayment[] {
  return getDb().prepare("SELECT * FROM order_payments WHERE order_id=? ORDER BY created_at ASC").all(orderId) as OrderPayment[];
}
// ---- MCP/admin shared surface aliases (same SQL owner, no forks) ----
export function recordIntent(args: { orderId: string; amountPaise: number; idempotencyKey: string; gateway?: string; gatewayPaymentId?: string | null }): { payment: OrderPayment; deduped: boolean } {
  return recordPaymentIntent(args.orderId, args.amountPaise, args.idempotencyKey, args.gateway ?? "demo", args.gatewayPaymentId ?? null);
}
// Webhook entry: signature is verified here. Without a configured gateway secret
// (PAYMENT_WEBHOOK_SECRET) every call is rejected — no order can reach paid.
export function applyWebhook(args: { gatewayPaymentId: string; status: string; signature: string; amountPaise?: number }): WebhookResult {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || "";
  if (!secret) return { ok: false, reason: "No payment gateway configured; webhook rejected." };
  const gatewayPaymentId = (args.gatewayPaymentId || "").trim().slice(0, 200);
  const status = (args.status || "").trim().slice(0, 40);
  if (!gatewayPaymentId) return { ok: false, reason: "Invalid webhook signature." };
  if (!signatureValid(secret, gatewayPaymentId, status, args.signature)) {
    return { ok: false, reason: "Invalid webhook signature." };
  }
  const to = WEBHOOK_TO_PAYMENT[status];
  if (!to) return { ok: false, reason: "Unknown webhook status." };
  const db = getDb();
  // Pure validation first (no writes): unknown payment, demo fence, amount match.
  const row = db.prepare("SELECT * FROM order_payments WHERE gateway_payment_id=?").get(gatewayPaymentId) as OrderPayment | undefined;
  if (!row) return { ok: false, reason: "Unknown payment; record the intent before applying the webhook." };
  if (row.gateway === "demo") return { ok: false, reason: "Demo payments cannot be captured; complete a gateway charge instead." };
  const order = db.prepare("SELECT id, total_paise, COALESCE(payment_status,'unpaid') AS payment_status, coupon_code, COALESCE(dispatch_status,'unfulfilled') AS dispatch_status FROM orders WHERE id=?").get(row.order_id) as OrderHead | undefined;
  if (!order) return { ok: false, reason: "Order not found." };
  if (args.amountPaise !== undefined && args.amountPaise !== order.total_paise) {
    return { ok: false, reason: "Amount does not match the order total." };
  }
  if (row.amount_paise !== order.total_paise) {
    return { ok: false, reason: "Amount does not match the order total." };
  }
  const from = order.payment_status || "unpaid";
  // Double delivery: the capture record already reflects this verdict — no re-apply.
  if (row.status === to) return { ok: true, deduped: true };
  if (!PAYMENT_NEXT[from]?.includes(to)) return { ok: false, reason: "This payment transition is not allowed." };
  try {
    db.transaction(() => {
      if (to === "paid") {
        capturePaid(db, order, row, from);
      } else if (to === "refunded") {
        // from === 'paid' enforced by PAYMENT_NEXT above.
        const lines = db.prepare("SELECT variant_id, quantity FROM order_items WHERE order_id=?").all(order.id) as { variant_id: number; quantity: number }[];
        const restock = db.prepare("UPDATE variants SET stock = stock + ? WHERE id=?");
        for (const line of lines) restock.run(line.quantity, line.variant_id);
        if (order.coupon_code) {
          db.prepare("UPDATE coupons SET used_count = CASE WHEN used_count > 0 THEN used_count - 1 ELSE 0 END WHERE code=?").run(order.coupon_code);
        }
        db.prepare("UPDATE order_payments SET status='refunded' WHERE id=?").run(row.id);
        db.prepare("UPDATE orders SET payment_status='refunded' WHERE id=?").run(order.id);
        db.prepare("INSERT INTO payment_events (order_id, from_status, to_status, actor) VALUES (?,?,?,?)").run(order.id, from, "refunded", "gateway-webhook");
      } else {
        // payment_failed: gateway-side failure, no stock or coupon movement.
        db.prepare("UPDATE order_payments SET status='payment_failed' WHERE id=?").run(row.id);
        db.prepare("UPDATE orders SET payment_status='payment_failed' WHERE id=?").run(order.id);
        db.prepare("INSERT INTO payment_events (order_id, from_status, to_status, actor) VALUES (?,?,?,?)").run(order.id, from, "payment_failed", "gateway-webhook");
      }
    })();
  } catch (error) {
    if (error instanceof PaymentError) {
      markCaptureFailed(order.id, row.id, from);
      return { ok: false, reason: error.message };
    }
    throw error;
  }
  return { ok: true };
}

/**
 * Paid capture inside the webhook transaction. Every guarded write is
 * conditional, so a concurrent capture that commits first makes this one fail
 * closed (throw → payment_failed, nothing partially applied):
 * coupon usage is counted here — never at checkout — so abandoned carts cannot
 * burn limited codes, and stock decrements only on verified capture.
 */
function capturePaid(db: ReturnType<typeof getDb>, order: OrderHead, row: OrderPayment, from: string): void {
  if (order.coupon_code) {
    const claimed = db.prepare(
      "UPDATE coupons SET used_count = used_count + 1 WHERE code=? AND (max_uses IS NULL OR used_count < max_uses)"
    ).run(order.coupon_code);
    if (claimed.changes !== 1) throw new PaymentError("Coupon usage limit reached; payment cannot be captured.");
  }
  const lines = db.prepare("SELECT variant_id, quantity FROM order_items WHERE order_id=?").all(order.id) as { variant_id: number; quantity: number }[];
  const take = db.prepare("UPDATE variants SET stock = stock - ? WHERE id=? AND stock >= ?");
  for (const line of lines) {
    const applied = take.run(line.quantity, line.variant_id, line.quantity);
    if (applied.changes !== 1) throw new PaymentError("Insufficient stock to capture this payment.");
  }
  db.prepare("UPDATE order_payments SET status='paid' WHERE id=?").run(row.id);
  db.prepare("UPDATE orders SET payment_status='paid' WHERE id=?").run(order.id);
  db.prepare("INSERT INTO payment_events (order_id, from_status, to_status, actor) VALUES (?,?,?,?)").run(order.id, from, "paid", "gateway-webhook");
}

/** Failure side-effect after a rolled-back capture: records payment_failed without touching stock/coupon. */
function markCaptureFailed(orderId: string, paymentRowId: string, from: string): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE order_payments SET status='payment_failed' WHERE id=?").run(paymentRowId);
    if (from === "unpaid" || from === "payment_pending") {
      db.prepare("UPDATE orders SET payment_status='payment_failed' WHERE id=? AND payment_status=?").run(orderId, from);
      db.prepare("INSERT INTO payment_events (order_id, from_status, to_status, actor) VALUES (?,?,?,?)").run(orderId, from, "payment_failed", "gateway-webhook");
    }
  })();
}
