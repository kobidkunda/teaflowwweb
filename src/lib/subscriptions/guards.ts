import { releaseTrialReservations } from "./trialInventory";
import { getDb } from '@/lib/db';
import { CommerceError, type Quote } from '@/lib/international/models';
import { enqueue } from '@/lib/international/store';
import { cycle, plan, record } from './store';
import { nextDispatch, type PlanDocument } from './model';

export function currentSubscriptionPayment(q: Quote, orderId: string) {
  if (!q.subscription) return true;
  if (!q.subscription.cycleId) return false;
  const c = cycle(q.subscription.cycleId);
  return c.order_id === orderId && c.generation === q.subscription.generation && ['awaiting_payment', 'ready'].includes(c.status);
}
export function validateSubscriptionReservation(q: Quote) {
  if (!q.subscription) return;
  if (q.input.coupon || !q.subscription.cycleId) throw new CommerceError('Create this order through your subscription.');
  const c = cycle(q.subscription.cycleId), p = plan(c.subscription_id);
  if (['cancelled','paused'].includes(p.status) || p.customer_id !== q.subscription.customerId || q.owner !== `subscription:${p.customer_id}` || c.generation !== q.subscription.generation || c.status !== 'draft' || c.quote_id !== q.id || c.order_id) throw new CommerceError('This renewal changed. Refresh its quote.');
}
export function attachSubscriptionOrder(q: Quote, orderId: string) {
  if (!q.subscription?.cycleId) return;
  const changed = getDb().prepare("UPDATE tea_subscription_cycles SET order_id=?,status=?,revision=revision+1 WHERE id=? AND generation=? AND status='draft' AND order_id IS NULL").run(orderId, q.input.method === 'cod' ? 'ready' : 'awaiting_payment', q.subscription.cycleId, q.subscription.generation);
  if (changed.changes !== 1) throw new CommerceError('This renewal changed. Refresh and try again.');
}
export function subscriptionCaptured(q: Quote, orderId: string, exception: boolean) {
  if (!q.subscription?.cycleId) return;
  const c = cycle(q.subscription.cycleId);
  if (!exception) {
    getDb().prepare("UPDATE tea_subscription_cycles SET status='ready',revision=revision+1,blocked_reason='' WHERE id=? AND order_id=? AND status='awaiting_payment'").run(c.id, orderId);
  } else {
    enqueue('subscription_refund', { orderId, cycleId: c.id }, `subscription:late-refund:${orderId}`);
    record(c.subscription_id, 'late_capture', { orderId });
  }
}
export function subscriptionFulfillmentGate(q: Quote, orderId: string) {
  if (!q.subscription?.cycleId) return;
  const c = cycle(q.subscription.cycleId);
  const order = getDb().prepare('SELECT payment_status,inventory_status,fulfillment_status FROM commerce_orders WHERE id=?').get(orderId) as { payment_status: string; inventory_status: string; fulfillment_status: string };
  if (c.order_id !== orderId || c.status !== 'ready' || c.due_ms > Date.now() || !['paid','cod_due'].includes(order.payment_status) || order.inventory_status === 'released' || order.fulfillment_status === 'cancelled') throw new CommerceError('This subscription shipment is not ready for dispatch.');
}
export function claimSubscriptionFulfillment(q: Quote, orderId: string) {
  if (!q.subscription?.cycleId) return;
  getDb().transaction(() => {
    subscriptionFulfillmentGate(q, orderId);
    const updated = getDb().prepare("UPDATE tea_subscription_cycles SET lease_ms=?,revision=revision+1 WHERE id=? AND status='ready' AND lease_ms=0").run(Date.now() + 120000, q.subscription!.cycleId);
    if (!updated.changes) throw new CommerceError('A shipment operation needs verification before continuing.');
  })();
}
export function releaseSubscriptionFulfillment(q: Quote) {
  if (q.subscription?.cycleId) getDb().prepare('UPDATE tea_subscription_cycles SET lease_ms=0 WHERE id=?').run(q.subscription.cycleId);
}
/** Physical handover, not AWB allocation, closes the change window. */
export function subscriptionHandover(q: Quote, orderId: string) {
  if (!q.subscription?.cycleId) return;
  getDb().transaction(() => {
    const c = cycle(q.subscription!.cycleId!);
    if (c.order_id !== orderId || !['ready','dispatching'].includes(c.status)) {
      record(c.subscription_id, 'handover_exception', { orderId });
      return;
    }
    const p = plan(c.subscription_id), doc = JSON.parse(p.document) as PlanDocument;
    getDb().prepare("UPDATE tea_subscription_cycles SET status='dispatched',lease_ms=0,revision=revision+1 WHERE id=?").run(c.id);
    getDb().prepare('UPDATE tea_subscriptions SET next_ms=?,revision=revision+1 WHERE id=?').run(nextDispatch(c.due_ms, doc.intervalDays, Date.now()), p.id);
    record(p.id, 'handover', { orderId });
  })();
}
export function releaseSubscriptionInventory(orderId: string) {
  const db = getDb();
  const claim = db.prepare("UPDATE commerce_orders SET inventory_status='released',fulfillment_status='cancelled' WHERE id=? AND inventory_status IN ('reserved','allocated')").run(orderId);
  if (claim.changes) {
    releaseTrialReservations(orderId);
    const rows = db.prepare('SELECT variant_id,quantity FROM commerce_reservations WHERE order_id=?').all(orderId) as { variant_id: number; quantity: number }[];
    for (const r of rows) db.prepare('UPDATE variants SET stock=stock+? WHERE id=?').run(r.quantity, r.variant_id);
  }
}
