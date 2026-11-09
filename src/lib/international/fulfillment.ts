import { claimSubscriptionFulfillment, releaseSubscriptionFulfillment, subscriptionHandover } from "@/lib/subscriptions/guards";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { CommerceError, type Quote } from "./models";
import { liveOrder, releaseExpired } from "./orders";
import { bookingPayload, shippingRequest, providerFetch } from "./providers";
import { enqueue, audit } from "./store";
export type Shipment = { order_id: string; document: string; status: string; updated_ms: number };
export function shipment(id: string) { return getDb().prepare("SELECT * FROM commerce_shipments WHERE order_id=?").get(id) as Shipment | undefined; }
export async function bookShipment(id: string, actor: string) {
  const order = liveOrder(id), q = JSON.parse(order.document) as Quote, db = getDb();
  if (!["paid", "partially_refunded", "cod_due", "cod_collected", "cod_remitted"].includes(order.payment_status) || order.inventory_status === "released") throw new CommerceError("Payment or inventory requires review before booking.");
  claimSubscriptionFulfillment(q, id);
  const claimed = db.prepare("INSERT INTO commerce_shipments (order_id,document,status,updated_ms) VALUES (?,?,'booking',?) ON CONFLICT(order_id) DO NOTHING").run(id, "{}", Date.now());
  if (!claimed.changes) { releaseSubscriptionFulfillment(q); return shipment(id); } // Never repeat a possibly successful remote create.
  audit(actor, "shipment.book", { orderId: id });
  try {
    let raw: unknown;
    if (q.input.address.country === "IN") raw = await shippingRequest("orders/create/adhoc", bookingPayload(id, q));
    else {
      const url = process.env.INTERNATIONAL_BOOKING_URL;
      if (!url || new URL(url).protocol !== "https:") throw new CommerceError("International booking needs account configuration.");
      raw = await providerFetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SHIPPING_BRIDGE_TOKEN || ""}`, "Idempotency-Key": id }, body: JSON.stringify({ orderId: id, quote: q, order: bookingPayload(id, q) }) });
    }
    const result = z.object({ order_id: z.number().or(z.string()), shipment_id: z.number().or(z.string()) }).parse(raw);
    db.prepare("UPDATE commerce_shipments SET document=?,status='booked',updated_ms=? WHERE order_id=?").run(JSON.stringify({ ...result, courierId: q.carrier }), Date.now(), id);
    db.prepare("UPDATE commerce_orders SET fulfillment_status='preparing' WHERE id=?").run(id);
  } catch {
    db.prepare("UPDATE commerce_shipments SET status='booking_uncertain',updated_ms=? WHERE order_id=?").run(Date.now(), id);
    throw new CommerceError("Booking requires provider reconciliation before retrying.");
  }
  releaseSubscriptionFulfillment(q);
  return shipment(id);
}
export async function shipmentAction(id: string, action: "label" | "pickup" | "track" | "awb", actor: string) {
  const s = shipment(id);
  if (!s || ["booking", "booking_uncertain"].includes(s.status)) throw new CommerceError("Reconcile the shipment before continuing.");
  const data = JSON.parse(s.document) as { shipment_id: number; courierId: string; [key: string]: unknown };
  if (action === "pickup" && data.pickup) return data.pickup;
  if (action === "awb" && data.awb) return data.awb;
  const q = JSON.parse(liveOrder(id).document) as Quote;
  if (action !== "track") claimSubscriptionFulfillment(q, id);
  const path = { label: "courier/generate/label", pickup: "courier/generate/pickup", awb: "courier/assign/awb", track: `courier/track/shipment/${data.shipment_id}` }[action];
  if (action === "pickup" || action === "awb") {
    const claim = getDb().prepare("UPDATE commerce_shipments SET status=? WHERE order_id=? AND status IN ('booked','labelled')").run(`${action}_pending`, id);
    if (!claim.changes) throw new CommerceError("This shipment action is pending verification.");
  }
  const result = await shippingRequest(path, action === "track" ? undefined : action === "awb" ? { shipment_id: data.shipment_id, courier_id: data.courierId } : { shipment_id: [data.shipment_id] });
  data[action] = result;
  if (action === "awb" && !q.subscription) {
    getDb().prepare("UPDATE commerce_orders SET fulfillment_status='dispatched' WHERE id=?").run(id);
    enqueue("email", { orderId: id, template: "order_shipped" }, `email:shipped:${id}`);
  }
  // Carrier tracking is retained privately; only explicitly projected fields reach guests.
  if (action === "track") {
    const tracking = z.object({ tracking_data: z.object({ shipment_status: z.number(), shipment_track: z.array(z.object({ awb_code: z.string().optional(), current_status: z.string().optional() })).optional() }) }).safeParse(result);
    if (tracking.success) {
      const safeStatus: Record<number, string> = { 6: "In transit", 7: "Delivered", 8: "Cancelled", 9: "Return in transit", 17: "Out for delivery" };
      data.publicTracking = { code: tracking.data.tracking_data.shipment_track?.[0]?.awb_code || "", status: safeStatus[tracking.data.tracking_data.shipment_status] || "Delivery update pending" };
      if ([6, 17].includes(tracking.data.tracking_data.shipment_status)) {
        subscriptionHandover(q, id);
        getDb().prepare("UPDATE commerce_orders SET fulfillment_status='shipped' WHERE id=?").run(id);
        enqueue("email", { orderId: id, template: "order_shipped" }, `email:shipped:${id}`);
      }
      const delivered = tracking.data.tracking_data.shipment_status === 7;
      if (delivered) subscriptionHandover(q, id);
      if (delivered) getDb().prepare("UPDATE commerce_orders SET fulfillment_status='delivered' WHERE id=?").run(id);
      // Deliberately never changes a COD payment state.
    }
  }
  getDb().prepare("UPDATE commerce_shipments SET document=?,status=?,updated_ms=? WHERE order_id=?").run(JSON.stringify(data), action === "label" ? "labelled" : "booked", Date.now(), id);
  if (action !== "track") releaseSubscriptionFulfillment(q);
  audit(actor, `shipment.${action}`, { orderId: id });
  return result;
}
export function reconcileCod(id: string, collectedMinor: number, reference: string, actor: string) {
  const row = liveOrder(id), q = JSON.parse(row.document) as Quote;
  if (q.input.method !== "cod" || !["cod_due", "cod_collected", "cod_remitted"].includes(row.payment_status) || collectedMinor !== q.totalMinor) throw new CommerceError("COD collection does not match this order.");
  getDb().transaction(() => {
    getDb().prepare("UPDATE commerce_orders SET payment_status='cod_remitted',inventory_status='allocated' WHERE id=?").run(id);
    audit(actor, "cod.remittance", { orderId: id, collectedMinor, reference });
  })();
}
export async function reconcilePayment(id: string, gatewayOrderId: string, actor: string) {
  const { razorpay } = await import("./providers");
  const row = liveOrder(id), q = JSON.parse(row.document) as Quote;
  const remote = z.object({ id: z.string(), receipt: z.string(), amount: z.number(), currency: z.string() }).parse(await razorpay(`orders/${encodeURIComponent(gatewayOrderId)}`));
  if (remote.receipt !== id || remote.amount !== q.totalMinor || remote.currency !== q.currency || (row.gateway_order_id && row.gateway_order_id !== remote.id)) throw new CommerceError("Gateway order does not match.");
  getDb().prepare("UPDATE commerce_orders SET gateway_order_id=?,payment_status=CASE WHEN payment_status IN ('creating','creation_uncertain') THEN 'payment_pending' ELSE payment_status END WHERE id=?").run(remote.id, id);
  audit(actor, "payment.reconcile", { orderId: id, gatewayOrderId });
  // Webhook remains the sole capture authority; queued unknown-order events retry after linking.
}
export function cancelUnpaid(id: string, actor: string) {
  const row = liveOrder(id);
  if ((JSON.parse(row.document) as Quote).subscription) throw new CommerceError("Cancel subscription renewals through subscription management.");
  if (!["cod_due", "payment_pending", "payment_failed", "creation_uncertain", "creating"].includes(row.payment_status) || shipment(id)) throw new CommerceError("Cancel requires an unshipped, unpaid order.");
  getDb().prepare("UPDATE commerce_orders SET payment_status='cancelled',reserved_until=0,fulfillment_status='cancelled' WHERE id=?").run(id);
  releaseExpired();
  audit(actor, "order.cancel", { orderId: id });
}
