import { releaseTrialReservations, reserveTrialLine } from "@/lib/subscriptions/trialInventory";
import { validateSubscriptionReservation, attachSubscriptionOrder, currentSubscriptionPayment, subscriptionCaptured } from "@/lib/subscriptions/guards";
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { currencyDigits } from "./money";
import { getDb } from "@/lib/db";
import { enabledProductCondition } from "@/lib/productAvailability";
import { validateCouponServer } from "@/lib/storefront";
import { CommerceError, type Quote } from "./models";
import { getQuote } from "./quotes";
import { razorpay, verifySignature } from "./providers";
import { enqueue } from "./store";
import { getActiveRazorpayCredentials, getPaymentSettings, resolveActiveGateway, type CommerceStream } from "@/lib/paymentSettings";
import { getActiveShiprocketCredentials, getShippingSettings } from "@/lib/shippingSettings";
import { getActiveYoupiClient } from "@/lib/youpi/config";
import type { YoupiWebhookEvent } from "@/lib/youpi/client";
export type LiveOrder = { id: string; owner: string; idempotency_key: string; quote_id: string; document: string; payment_status: string;
  fulfillment_status: string; gateway_order_id: string | null; gateway_payment_id: string | null; reserved_until: number;
  inventory_status: string; refund_minor: number; created_ms: number };
export function normalizeOrder(row: LiveOrder): LiveOrder { return { ...row, reserved_until: Number(row.reserved_until), refund_minor: Number(row.refund_minor), created_ms: Number(row.created_ms) }; }
export function liveOrder(id: string): LiveOrder {
  const row = getDb().prepare("SELECT * FROM commerce_orders WHERE id=?").get(id) as LiveOrder | undefined;
  if (!row) throw new CommerceError("Order not found.");
  return normalizeOrder(row);
}
export function guestToken(id: string, expires = Date.now() + 7 * 86400000) {
  const secret = process.env.ORDER_ACCESS_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new CommerceError("Secure order access is not configured.");
  return `${expires}.${createHmac("sha256", secret).update(`${id}.${expires}`).digest("hex")}`;
}
export function validGuestToken(id: string, token: string) {
  const [expires, sig] = token.split(".");
  const secret = process.env.ORDER_ACCESS_SECRET || process.env.SESSION_SECRET || "";
  return /^\d{13}$/.test(expires || "") && Number(expires) > Date.now() && verifySignature(`${id}.${expires}`, sig || "", secret);
}
export function releaseExpired() {
  const db = getDb();
  db.transaction(() => {
    const rows = db.prepare("SELECT * FROM commerce_orders WHERE inventory_status='reserved' AND reserved_until < ? AND payment_status NOT IN ('paid','cod_due')").all(Date.now()) as LiveOrder[];
    for (const row of rows) {
      const claim = db.prepare("UPDATE commerce_orders SET inventory_status='released' WHERE id=? AND inventory_status='reserved'").run(row.id);
      if (!claim.changes) continue;
      releaseTrialReservations(row.id);
      const lines = db.prepare("SELECT variant_id,quantity FROM commerce_reservations WHERE order_id=?").all(row.id) as { variant_id: number; quantity: number }[];
      for (const line of lines) db.prepare("UPDATE variants SET stock=stock+? WHERE id=?").run(line.quantity, line.variant_id);
      const hold = db.prepare("SELECT code FROM commerce_coupon_holds WHERE order_id=?").get(row.id) as { code: string } | undefined;
      if (hold) db.prepare("UPDATE coupons SET used_count=CASE WHEN used_count>0 THEN used_count-1 ELSE 0 END WHERE code=?").run(hold.code);
      db.prepare("DELETE FROM commerce_coupon_holds WHERE order_id=?").run(row.id);
    }
  })();
}
function reserve(quoteId: string, owner: string, key: string): { row: LiveOrder; created: boolean } {
  const db = getDb();
  releaseExpired();
  return db.transaction(() => {
    const prior = db.prepare("SELECT * FROM commerce_orders WHERE idempotency_key=? OR quote_id=?").get(key, quoteId) as LiveOrder | undefined;
    if (prior) {
      if (prior.owner !== owner || prior.quote_id !== quoteId) throw new CommerceError("This checkout key cannot be reused.");
      return { row: prior, created: false };
    }
    const q = getQuote(quoteId, owner);
    validateSubscriptionReservation(q);
    guestToken(q.id); // Fail before reserving if order signing is unconfigured.
    const id = randomUUID();
    for (const l of q.lines) {
      if (l.trialId) { reserveTrialLine(l); continue; }
      const result = db.prepare(`UPDATE variants SET stock=stock-? WHERE id=? AND stock>=? AND price_paise=? AND EXISTS (SELECT 1 FROM products p WHERE p.id=variants.product_id AND ${enabledProductCondition("p")} AND p.status='published')`).run(l.quantity, l.variantId, l.quantity, l.pricePaise);
      if (result.changes !== 1) throw new CommerceError("A tea's price or availability changed. Please request a new quote.");
    }
    if (q.input.coupon) {
      const check = validateCouponServer(q.input.coupon, q.subtotalPaise);
      if (!check.valid || check.discountPaise !== q.discountPaise) throw new CommerceError("The offer changed. Please request a new quote.");
      const held = db.prepare("UPDATE coupons SET used_count=used_count+1 WHERE code=? AND (max_uses IS NULL OR used_count<max_uses)").run(q.input.coupon.toUpperCase());
      if (!held.changes) throw new CommerceError("The offer is no longer available.");
    }
    const status = q.input.method === "cod" ? "cod_due" : "creating";
    db.prepare("INSERT INTO commerce_orders (id,owner,idempotency_key,quote_id,document,payment_status,reserved_until,created_ms) VALUES (?,?,?,?,?,?,?,?)").run(id, owner, key, quoteId, JSON.stringify(q), status, q.expires, Date.now());
    for (const l of q.lines) {
      if (l.trialId) {
        if (l.trialTracked) db.prepare("INSERT INTO tea_trial_reservations(order_id,trial_id,quantity) VALUES (?,?,?)").run(id, l.trialId, l.quantity);
      } else db.prepare("INSERT INTO commerce_reservations (order_id,variant_id,quantity) VALUES (?,?,?)").run(id, l.variantId, l.quantity);
    }
    if (q.input.coupon) db.prepare("INSERT INTO commerce_coupon_holds (order_id,code) VALUES (?,?)").run(id, q.input.coupon.toUpperCase());
    attachSubscriptionOrder(q, id);
    if (status === "cod_due") {
      enqueue("email", { orderId: id, template: "commerce_order_received" }, `email:confirmation:${id}`);
      try {
        const srConfig = getActiveShiprocketCredentials();
        if (!q.subscription && srConfig.orderCreationMode === "auto") {
          enqueue("auto_dispatch", { orderId: id }, `dispatch:auto:${id}`);
          import("@/lib/shiprocket").then(({ prepareFullShiprocketShipment }) => {
            prepareFullShiprocketShipment(id, "system_auto").catch(() => {});
          }).catch(() => {});
        }
      } catch {}
    }
    return { row: liveOrder(id), created: true };
  })();
}
export async function startPayment(quoteId: string, owner: string, key: string) {
  // Separate claim from network call: uncertain provider writes must be reconciled, never blindly repeated.
  const { row, created } = reserve(quoteId, owner, key);
  const q = JSON.parse(row.document) as Quote;

  // CRITICAL: Cash on Delivery must NEVER route to YouPI or any payment gateway!
  if (q.input.method === "cod" || row.payment_status === "cod_due") {
    return {
      orderId: row.id,
      token: guestToken(row.id),
      paymentStatus: "cod_due" as const,
      gateway: "cod" as const,
      gatewayOrderId: null,
      checkoutUrl: undefined,
      keyId: "",
      amount: q.totalMinor,
      currency: q.currency,
      expires: q.expires,
      preferredMethod: "cod" as const,
    };
  }

  const paySettings = getPaymentSettings();
  if (!paySettings.online_payment_enabled) {
    throw new CommerceError("Online payment is currently disabled. Please checkout using Cash on Delivery.");
  }

  let stream: CommerceStream = "direct_purchase";
  if (q.subscription) {
    stream = "subscription";
  } else if (q.lines?.some((l) => Boolean(l.trialId))) {
    stream = "sample_kit";
  }
  const activeGateway = resolveActiveGateway(stream);

  if (created && row.payment_status === "creating") {
    if (activeGateway === "youpi") {
      try {
        const client = getActiveYoupiClient();
        const appBase = (process.env.APP_BASE_URL || "https://teafloww.com").replace(/\/+$/, "");
        const returnUrl = `${appBase}/purchase/${row.id}?token=${encodeURIComponent(guestToken(row.id))}`;
        const session = await client.createPaymentSession({
          orderId: row.id,
          amount: (q.totalMinor / 100).toFixed(2),
          currency: q.currency,
          returnUrl,
          customer: {
            fullName: q.input.address.name,
            email: q.input.address.email,
            phoneNumber: q.input.address.phone,
          },
          metadata: {
            teafloww_order: row.id,
            stream,
            preferred_method: q.input.method,
            discount_paise: String(q.paymentDiscountPaise || 0),
          },
          idempotencyKey: key,
        });

        const updatedDoc = JSON.stringify({
          ...q,
          gateway: "youpi",
          checkoutUrl: session.checkoutUrl,
        });

        getDb().prepare("UPDATE commerce_orders SET gateway_order_id=?,document=?,payment_status='payment_pending' WHERE id=? AND payment_status='creating'").run(session.paymentId, updatedDoc, row.id);
      } catch {
        getDb().prepare("UPDATE commerce_orders SET payment_status='creation_uncertain' WHERE id=? AND payment_status='creating'").run(row.id);
        throw new CommerceError("Payment creation needs verification. Your order was saved; do not retry with a new order.");
      }
    } else {
      try {
        const remote = z.object({ id: z.string().regex(/^order_[a-zA-Z0-9]+$/), amount: z.number().int(), currency: z.string() }).parse(await razorpay("orders", {
          amount: q.totalMinor,
          currency: q.currency,
          receipt: row.id,
          notes: {
            teafloww_order: row.id,
            preferred_method: q.input.method,
            discount_paise: String(q.paymentDiscountPaise || 0),
          },
        }));
        if (remote.amount !== q.totalMinor || remote.currency !== q.currency) throw new CommerceError("Payment amount verification failed.");
        const updatedDoc = JSON.stringify({
          ...q,
          gateway: "razorpay",
        });
        getDb().prepare("UPDATE commerce_orders SET gateway_order_id=?,document=?,payment_status='payment_pending' WHERE id=? AND payment_status='creating'").run(remote.id, updatedDoc, row.id);
      } catch {
        getDb().prepare("UPDATE commerce_orders SET payment_status='creation_uncertain' WHERE id=? AND payment_status='creating'").run(row.id);
        throw new CommerceError("Payment creation needs verification. Your order was saved; do not retry with a new order.");
      }
    }
  }

  const current = liveOrder(row.id);
  if (current.payment_status === "creation_uncertain" || current.payment_status === "creating") throw new CommerceError("Your payment request is being verified. Contact us with your order reference.");

  let orderDoc: Record<string, unknown> = {};
  try {
    orderDoc = JSON.parse(current.document);
  } catch {}

  const isYoupi = orderDoc.gateway === "youpi";
  const creds = getActiveRazorpayCredentials();

  let youpiCheckoutUrl: string | undefined = undefined;
  if (isYoupi) {
    if (typeof orderDoc.checkoutUrl === "string" && orderDoc.checkoutUrl) {
      youpiCheckoutUrl = orderDoc.checkoutUrl;
    } else if (current.gateway_order_id) {
      youpiCheckoutUrl = `${getActiveYoupiClient().checkoutUrl}/checkout/${encodeURIComponent(current.gateway_order_id)}`;
    }
  }

  return {
    orderId: row.id,
    token: guestToken(row.id),
    paymentStatus: current.payment_status,
    gateway: isYoupi ? ("youpi" as const) : ("razorpay" as const),
    gatewayOrderId: current.gateway_order_id,
    checkoutUrl: youpiCheckoutUrl,
    keyId: isYoupi ? "" : (creds.keyId || process.env.RAZORPAY_KEY_ID || ""),
    amount: q.totalMinor,
    currency: q.currency,
    expires: q.expires,
    preferredMethod: q.input.method,
  };
}
export const paymentEventSchema = z.object({ event: z.enum(["payment.captured", "payment.failed", "refund.processed"]), payload: z.object({ payment: z.object({ entity: z.object({ id: z.string(), order_id: z.string(), amount: z.number().int(), currency: z.string(), status: z.string() }) }).optional(), refund: z.object({ entity: z.object({ id: z.string(), payment_id: z.string(), amount: z.number().int().positive(), status: z.literal("processed") }) }).optional() }) });
export function applyPaymentEvent(id: string, raw: unknown) {
  const event = paymentEventSchema.parse(raw), db = getDb();
  db.transaction(() => {
    if (db.prepare("SELECT id FROM commerce_events WHERE id=?").get(id)) return;
    if (event.event === "refund.processed") {
      const refund = event.payload.refund?.entity;
      if (!refund) throw new CommerceError("Invalid refund event.");
      const order = db.prepare("SELECT * FROM commerce_orders WHERE gateway_payment_id=?").get(refund.payment_id) as LiveOrder | undefined;
      if (!order) throw new CommerceError("Refund order is pending reconciliation.");
      db.prepare("UPDATE commerce_orders SET refund_minor=refund_minor WHERE id=?").run(order.id);
      const currentOrder = liveOrder(order.id);
      const q = JSON.parse(order.document) as Quote;
      const refundEvent = `refund-confirmed:${refund.id}`;
      if (!db.prepare("SELECT id FROM commerce_events WHERE id=?").get(refundEvent)) {
        if (currentOrder.refund_minor + refund.amount > q.totalMinor) throw new CommerceError("Refund exceeds order amount.");
        db.prepare("UPDATE commerce_orders SET refund_minor=refund_minor+?,payment_status=? WHERE id=?").run(refund.amount, currentOrder.refund_minor + refund.amount === q.totalMinor ? "refunded" : "partially_refunded", order.id);
        db.prepare("INSERT INTO commerce_events (id,kind,document,created_ms) VALUES (?,?,?,?)").run(refundEvent, "refund", JSON.stringify({ orderId: order.id, amount: refund.amount }), Date.now());
      }
    } else {
      const p = event.payload.payment?.entity;
      if (!p) throw new CommerceError("Invalid payment event.");
      const row = db.prepare("SELECT * FROM commerce_orders WHERE gateway_order_id=?").get(p.order_id) as LiveOrder | undefined;
      if (!row) throw new CommerceError("Payment order is pending reconciliation.");
      db.prepare("UPDATE commerce_orders SET refund_minor=refund_minor WHERE id=?").run(row.id);
      const currentRow = liveOrder(row.id);
      const q = JSON.parse(row.document) as Quote;
      if (q.totalMinor !== p.amount || q.currency !== p.currency) throw new CommerceError("Payment amount does not match.");
      if (event.event === "payment.captured" && p.status === "captured") {
        if (!currentRow.gateway_payment_id) {
          const status = currentRow.inventory_status === "released" || !currentSubscriptionPayment(q, row.id) ? "paid_exception" : "paid";
          const result = db.prepare("UPDATE commerce_orders SET payment_status=?,gateway_payment_id=?,inventory_status=? WHERE id=? AND gateway_payment_id IS NULL").run(status, p.id, currentRow.inventory_status === "released" ? "released" : "allocated", row.id);
          if (result.changes) {
            subscriptionCaptured(q, row.id, status === "paid_exception");
            enqueue("email", { orderId: row.id, template: status === "paid_exception" ? "commerce_payment_review" : "commerce_order_received" }, `email:confirmation:${row.id}`);
            if (status === "paid") {
              try {
                const srConfig = getActiveShiprocketCredentials();
                if (!q.subscription && srConfig.orderCreationMode === "auto") {
                  enqueue("auto_dispatch", { orderId: row.id }, `dispatch:auto:${row.id}`);
                  import("@/lib/shiprocket").then(({ prepareFullShiprocketShipment }) => {
                    prepareFullShiprocketShipment(row.id, "system_auto").catch(() => {});
                  }).catch(() => {});
                }
              } catch {}
            }
          }
        } else if (currentRow.gateway_payment_id !== p.id) {
          enqueue("payment_exception", { orderId: row.id, paymentId: p.id, reason: "Additional capture requires refund review" }, `capture:${p.id}`);
        }
      } else if (event.event === "payment.failed" && !currentRow.gateway_payment_id && currentRow.payment_status !== "cancelled") {
        db.prepare("UPDATE commerce_orders SET payment_status='payment_failed' WHERE id=? AND gateway_payment_id IS NULL").run(row.id);
      }
    }
    db.prepare("INSERT INTO commerce_events (id,kind,document,created_ms) VALUES (?,?,?,?)").run(id, event.event, "{}", Date.now());
  })();
}

export function applyYoupiPaymentEvent(deliveryId: string, event: YoupiWebhookEvent) {
  const db = getDb();
  db.transaction(() => {
    const eventKey = `youpi:${deliveryId || event.paymentId}`;
    if (db.prepare("SELECT id FROM commerce_events WHERE id=?").get(eventKey)) return;

    const row = db
      .prepare("SELECT * FROM commerce_orders WHERE id=? OR gateway_order_id=?")
      .get(event.orderId, event.paymentId) as LiveOrder | undefined;

    if (!row) throw new CommerceError(`Order not found for YouPI payment: ${event.orderId}`);

    const currentRow = liveOrder(row.id);
    const q = JSON.parse(row.document) as Quote;

    if (event.event === "SUCCESS") {
      if (q.totalMinor !== event.amountPaise || q.currency !== event.currency) {
        throw new CommerceError("Payment amount or currency mismatch.");
      }

      if (!currentRow.gateway_payment_id) {
        const status =
          currentRow.inventory_status === "released" ||
          !currentSubscriptionPayment(q, row.id)
            ? "paid_exception"
            : "paid";

        const result = db
          .prepare(
            "UPDATE commerce_orders SET payment_status=?,gateway_payment_id=?,inventory_status=? WHERE id=? AND gateway_payment_id IS NULL"
          )
          .run(
            status,
            event.paymentId,
            currentRow.inventory_status === "released" ? "released" : "allocated",
            row.id
          );

        if (result.changes) {
          subscriptionCaptured(q, row.id, status === "paid_exception");
          enqueue(
            "email",
            {
              orderId: row.id,
              template:
                status === "paid_exception"
                  ? "commerce_payment_review"
                  : "commerce_order_received",
            },
            `email:confirmation:${row.id}`
          );

          if (status === "paid") {
            try {
              const srConfig = getActiveShiprocketCredentials();
              if (!q.subscription && srConfig.orderCreationMode === "auto") {
                enqueue("auto_dispatch", { orderId: row.id }, `dispatch:auto:${row.id}`);
                import("@/lib/shiprocket")
                  .then(({ prepareFullShiprocketShipment }) => {
                    prepareFullShiprocketShipment(row.id, "system_auto").catch(() => {});
                  })
                  .catch(() => {});
              }
            } catch {}
          }
        }
      }
      db.prepare(
        "INSERT INTO commerce_events (id,kind,document,created_ms) VALUES (?,?,?,?)"
      ).run(
        eventKey,
        "youpi_payment",
        JSON.stringify({
          orderId: row.id,
          paymentId: event.paymentId,
          amountPaise: event.amountPaise,
          utr: event.utr || null,
        }),
        Date.now()
      );
    } else if (
      (event.event === "FAILED" || event.event === "EXPIRED" || event.event === "CANCELLED") &&
      !currentRow.gateway_payment_id &&
      currentRow.payment_status !== "cancelled"
    ) {
      db.prepare(
        "UPDATE commerce_orders SET payment_status='payment_failed' WHERE id=? AND gateway_payment_id IS NULL"
      ).run(row.id);

      db.prepare(
        "INSERT INTO commerce_events (id,kind,document,created_ms) VALUES (?,?,?,?)"
      ).run(
        eventKey,
        "youpi_failed",
        JSON.stringify({
          orderId: row.id,
          paymentId: event.paymentId,
          event: event.event,
        }),
        Date.now()
      );
    }
  })();
}

export async function syncYoupiOrderStatus(order: LiveOrder): Promise<LiveOrder> {
  if (["paid", "cod_due", "cod_remitted", "refunded"].includes(order.payment_status)) {
    return order;
  }
  let orderDoc: Record<string, unknown> = {};
  try {
    orderDoc = JSON.parse(order.document);
  } catch {}

  const isYoupi = orderDoc.gateway === "youpi" || Boolean(order.gateway_order_id && !order.gateway_order_id.startsWith("order_"));
  if (!isYoupi || !order.gateway_order_id) return order;

  try {
    const client = getActiveYoupiClient(4000);
    const session = await client.getPaymentSession(order.gateway_order_id);
    if (session.status === "SUCCESS") {
      const q = JSON.parse(order.document) as Quote;
      const amountPaise = session.amountPaise ? Number(session.amountPaise) : Math.round(Number(session.amount) * 100);
      applyYoupiPaymentEvent(`sync:${session.paymentId}`, {
        event: "SUCCESS",
        deliveryId: `sync_${session.paymentId}_${Date.now()}`,
        timestamp: Date.now(),
        paymentId: session.paymentId,
        orderId: order.id,
        amount: session.amount,
        amountPaise: amountPaise || q.totalMinor,
        currency: session.currency || q.currency,
        method: session.method || "UPI",
      });
      return liveOrder(order.id);
    } else if (["FAILED", "EXPIRED", "CANCELLED"].includes(session.status)) {
      if (order.payment_status !== "payment_failed") {
        getDb().prepare("UPDATE commerce_orders SET payment_status='payment_failed' WHERE id=? AND gateway_payment_id IS NULL").run(order.id);
        getDb().prepare("INSERT INTO commerce_events (id,kind,document,created_ms) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING").run(
          `youpi:sync_fail:${session.paymentId}`,
          "youpi_failed",
          JSON.stringify({ orderId: order.id, paymentId: session.paymentId, status: session.status }),
          Date.now()
        );
      }
      return liveOrder(order.id);
    }
  } catch {
    // Non-blocking sync attempt
  }
  return liveOrder(order.id);
}

export function switchOrderToCod(id: string, token: string): LiveOrder {
  if (!validGuestToken(id, token)) {
    throw new CommerceError("Unauthorized to modify this order.");
  }
  const db = getDb();
  return db.transaction(() => {
    const order = liveOrder(id);
    if (order.payment_status === "cod_due" || order.payment_status === "paid") {
      return order;
    }
    const eligibleStatuses = ["payment_pending", "payment_failed", "creating", "creation_uncertain"];
    if (!eligibleStatuses.includes(order.payment_status)) {
      throw new CommerceError(`Order cannot be converted to Cash on Delivery from status: ${order.payment_status}`);
    }

    const q = JSON.parse(order.document) as Quote;
    const country = q.input.address.country;
    if (country !== "IN") {
      throw new CommerceError("Cash on delivery is currently only available for domestic delivery in India.");
    }

    const shipSettings = getShippingSettings();
    if (!shipSettings.cod_enabled) {
      throw new CommerceError("Cash on delivery is currently disabled.");
    }
    const subtotalRupees = Math.round(q.subtotalPaise / 100);
    if (shipSettings.cod_min_rupees > 0 && subtotalRupees < shipSettings.cod_min_rupees) {
      throw new CommerceError(`Cash on delivery requires a minimum bag value of ₹${shipSettings.cod_min_rupees}.`);
    }
    if (shipSettings.cod_max_rupees > 0 && subtotalRupees > shipSettings.cod_max_rupees) {
      throw new CommerceError(`Cash on delivery is available for orders up to ₹${shipSettings.cod_max_rupees}.`);
    }

    const codFeePaise = shipSettings.cod_fee_paise;
    const previousMethod = q.input.method;
    const updatedInput = { ...q.input, method: "cod" as const };
    
    const prevPaymentDiscountPaise = q.paymentDiscountPaise || 0;
    const existingCodFee = q.components?.cod || 0;
    const addedCodFee = existingCodFee ? 0 : codFeePaise;
    const newTotalPaise = q.totalPaise + prevPaymentDiscountPaise + addedCodFee;
    
    const updatedQuote: Quote = {
      ...q,
      input: updatedInput,
      paymentDiscountPaise: 0,
      totalPaise: newTotalPaise,
      totalMinor: newTotalPaise,
      components: {
        ...q.components,
        paymentDiscount: undefined,
        cod: (existingCodFee || codFeePaise),
      },
    };

    const updatedDoc = JSON.stringify(updatedQuote);
    db.prepare(`
      UPDATE commerce_orders
      SET payment_status = 'cod_due',
          inventory_status = 'allocated',
          document = ?,
          gateway_order_id = NULL
      WHERE id = ?
    `).run(updatedDoc, id);

    db.prepare(`
      INSERT INTO commerce_events (id, kind, document, created_ms)
      VALUES (?, ?, ?, ?)
    `).run(
      `switched-to-cod:${id}:${Date.now()}`,
      "switched_to_cod",
      JSON.stringify({
        orderId: id,
        previousMethod,
        switchedAt: Date.now(),
      }),
      Date.now()
    );

    enqueue(
      "email",
      { orderId: id, template: "commerce_order_received" },
      `email:confirmation:${id}:cod`
    );

    const srConfig = getActiveShiprocketCredentials();
    if (!q.subscription && srConfig.orderCreationMode === "auto") {
      enqueue("auto_dispatch", { orderId: id }, `dispatch:auto:${id}`);
      import("@/lib/shiprocket")
        .then(({ prepareFullShiprocketShipment }) => {
          prepareFullShiprocketShipment(id, "system_auto").catch(() => {});
        })
        .catch(() => {});
    }

    return liveOrder(id);
  })();
}

export async function retryOrderPayment(id: string, token: string): Promise<{ gateway: "youpi" | "razorpay"; checkoutUrl?: string; orderId: string; keyId?: string }> {
  if (!validGuestToken(id, token)) {
    throw new CommerceError("Unauthorized to retry payment for this order.");
  }
  const order = liveOrder(id);
  if (order.payment_status === "paid" || order.payment_status === "cod_due") {
    throw new CommerceError("This order is already confirmed.");
  }

  const paySettings = getPaymentSettings();
  if (!paySettings.online_payment_enabled) {
    throw new CommerceError("Online payment is currently disabled. Please switch this order to Cash on Delivery.");
  }

  const q = JSON.parse(order.document) as Quote;
  let stream: CommerceStream = "direct_purchase";
  if (q.subscription) stream = "subscription";
  else if (q.lines?.some((l) => Boolean(l.trialId))) stream = "sample_kit";
  const activeGateway = resolveActiveGateway(stream);

  if (activeGateway === "youpi") {
    const client = getActiveYoupiClient();
    const appBase = (process.env.APP_BASE_URL || "https://teafloww.com").replace(/\/+$/, "");
    const returnUrl = `${appBase}/purchase/${order.id}?token=${encodeURIComponent(guestToken(order.id))}`;
    const retryKey = randomUUID();
    const session = await client.createPaymentSession({
      orderId: order.id,
      amount: (q.totalMinor / 100).toFixed(2),
      currency: q.currency,
      returnUrl,
      customer: {
        fullName: q.input.address.name,
        email: q.input.address.email,
        phoneNumber: q.input.address.phone,
      },
      metadata: {
        teafloww_order: order.id,
        stream,
        retry: true,
      },
      idempotencyKey: retryKey,
    });

    const updatedDoc = JSON.stringify({
      ...q,
      gateway: "youpi",
      checkoutUrl: session.checkoutUrl,
    });

    getDb().prepare(`
      UPDATE commerce_orders
      SET gateway_order_id = ?,
          document = ?,
          payment_status = 'payment_pending'
      WHERE id = ?
    `).run(session.paymentId, updatedDoc, order.id);

    return {
      gateway: "youpi",
      checkoutUrl: session.checkoutUrl,
      orderId: order.id,
    };
  } else {
    const remote = z.object({ id: z.string().regex(/^order_[a-zA-Z0-9]+$/), amount: z.number().int(), currency: z.string() }).parse(await razorpay("orders", {
      amount: q.totalMinor,
      currency: q.currency,
      receipt: order.id,
      notes: { teafloww_order: order.id, retry: "true" },
    }));
    const updatedDoc = JSON.stringify({
      ...q,
      gateway: "razorpay",
    });
    getDb().prepare("UPDATE commerce_orders SET gateway_order_id=?,document=?,payment_status='payment_pending' WHERE id=?").run(remote.id, updatedDoc, order.id);
    const creds = getActiveRazorpayCredentials();
    return {
      gateway: "razorpay",
      keyId: creds.keyId || process.env.RAZORPAY_KEY_ID || "",
      orderId: order.id,
    };
  }
}
export async function refundOrder(id: string, amount: number, key: string) {
  const db = getDb(), row = liveOrder(id), q = JSON.parse(row.document) as Quote;
  if (!row.gateway_payment_id || !["paid", "paid_exception", "partially_refunded"].includes(row.payment_status)) throw new CommerceError("This order cannot be refunded.");
  const claim = db.transaction(() => {
    db.prepare("UPDATE commerce_orders SET refund_minor=refund_minor WHERE id=?").run(id);
    if (currencyDigits(q.currency) === 3 && amount % 10 !== 0) throw new CommerceError("This currency requires refunds in multiples of ten minor units.");
    const prior = db.prepare("SELECT document FROM commerce_events WHERE id=?").get(`refund-request:${key}`) as { document: string } | undefined;
    if (prior) { if (JSON.parse(prior.document).orderId !== id) throw new CommerceError("Refund key cannot be reused."); return false; }
    const pending = db.prepare("SELECT document FROM commerce_events WHERE kind='refund_request'").all() as { document: string }[];
    const held = pending.map(r => JSON.parse(r.document) as { orderId: string; amount: number }).filter(r => r.orderId === id).reduce((s, r) => s + r.amount, 0);
    if (!Number.isSafeInteger(amount) || amount < 1 || held + amount > q.totalMinor) throw new CommerceError("Refund exceeds the remaining refundable amount.");
    db.prepare("INSERT INTO commerce_events (id,kind,document,created_ms) VALUES (?,?,?,?)").run(`refund-request:${key}`, "refund_request", JSON.stringify({ orderId: id, amount, state: "submitting" }), Date.now());
    return true;
  })();
  if (!claim) return;
  const remote = z.object({ id: z.string() }).parse(await razorpay(`payments/${encodeURIComponent(row.gateway_payment_id)}/refund`, { amount, receipt: key, notes: { order_id: id } }));
  db.prepare("UPDATE commerce_events SET document=? WHERE id=?").run(JSON.stringify({ orderId: id, amount, state: "pending", refundId: remote.id }), `refund-request:${key}`);
}
