import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { CommerceError, type Quote } from '@/lib/international/models';
import { createQuote, getQuote, publicQuote } from '@/lib/international/quotes';
import { liveOrder, startPayment, refundOrder } from '@/lib/international/orders';
import { enqueue } from '@/lib/international/store';
import { shipment } from '@/lib/international/fulfillment';
import { shippingRequest } from '@/lib/international/providers';
import { subscriptionPolicy, plan, cycle, openCycle, record } from './store';
import { DAY, CONSENT, dispatchDate, nextDispatch, previewSchema, actionSchema, type PlanDocument, type Cycle } from './model';
import { releaseSubscriptionInventory } from './guards';
const owner = (id: string) => `subscription:${id}`;
function futureDate(value: string) {
  let ms: number;
  try { ms = dispatchDate(value); } catch { throw new CommerceError('Choose a valid dispatch date.'); }
  if (ms < Date.now() - 12 * 3600000 || ms > Date.now() + 365 * DAY) throw new CommerceError('Choose a dispatch date within the next year.');
  return Math.max(ms, Date.now());
}
export async function previewSubscription(raw: unknown, customerId: string) {
  const input = previewSchema.parse(raw), policy = subscriptionPolicy();
  if (!policy.enabled) throw new CommerceError('Subscriptions are not enabled yet.');
  const q = await createQuote(input.input, owner(customerId), { customerId, policy, intervalDays: input.intervalDays, dueMs: futureDate(input.dispatchDate) });
  return { ...publicQuote(q), policy, consent: CONSENT, dueMs: q.subscription!.dueMs };
}
export function enrollSubscription(raw: unknown, customerId: string) {
  const input = z.object({ quoteId: z.string().uuid(), idempotencyKey: z.string().uuid(), consent: z.literal(true) }).strict().parse(raw), db = getDb();
  return db.transaction(() => {
    const old = db.prepare('SELECT id,customer_id FROM tea_subscriptions WHERE enrollment_key=?').get(input.idempotencyKey) as { id: string; customer_id: string } | undefined;
    if (old) { if (old.customer_id !== customerId) throw new CommerceError('Checkout key cannot be reused.'); return { subscriptionId: old.id }; }
    const reused = db.prepare('SELECT id FROM tea_subscriptions WHERE enrollment_key=?').get(`quote:${input.quoteId}`);
    if (reused) throw new CommerceError('This quote has already been used.');
    const q = getQuote(input.quoteId, owner(customerId)), ctx = q.subscription;
    if (!ctx || ctx.customerId !== customerId || ctx.cycleId || !subscriptionPolicy().enabled || ctx.policy.version !== subscriptionPolicy().version) throw new CommerceError('Review a fresh subscription quote.');
    // Each preview can enroll only once even when a caller changes its request key.
    const used = db.prepare("SELECT id FROM tea_subscription_events WHERE id=?").get(`enroll:${q.id}`);
    if (used) throw new CommerceError('This quote has already been used.');
    const id = randomUUID(), now = Date.now();
    const document: PlanDocument = { input: q.input, policy: ctx.policy, intervalDays: ctx.intervalDays, acceptedTotal: q.totalPaise, consent: CONSENT };
    db.prepare('INSERT INTO tea_subscriptions(id,customer_id,enrollment_key,document,next_ms,created_ms) VALUES (?,?,?,?,?,?)').run(id, customerId, input.idempotencyKey, JSON.stringify(document), ctx.dueMs, now);
    db.prepare('INSERT INTO tea_subscription_events(id,subscription_id,action,document,created_ms) VALUES (?,?,?,?,?)').run(`enroll:${q.id}`, id, 'consent', JSON.stringify({ version: ctx.policy.version, consent: CONSENT, totalPaise: q.totalPaise }), now);
    newCycle(plan(id));
    enqueue('subscription_tick', {}, `subscription:enroll:${id}`);
    return { subscriptionId: id };
  })();
}
function newCycle(p: ReturnType<typeof plan>) {
  const current = openCycle(p.id); if (current) return current;
  const db = getDb(), doc = JSON.parse(p.document) as PlanDocument, id = randomUUID();
  const seq = db.prepare('SELECT MAX(sequence) AS seq FROM tea_subscription_cycles WHERE subscription_id=?').get(p.id) as { seq: number | null };
  db.prepare('INSERT INTO tea_subscription_cycles(id,subscription_id,sequence,due_ms,method,created_ms) VALUES (?,?,?,?,?,?)').run(id, p.id, Number(seq.seq || 0) + 1, p.next_ms, doc.input.method === 'cod' ? 'cod' : 'prepaid', Date.now());
  return cycle(id);
}
function mutable(c: Cycle) {
  if (!['draft','awaiting_payment','ready','exception'].includes(c.status) || c.lease_ms !== 0) throw new CommerceError('A shipment operation needs verification before this change. Refresh shortly.');
  if (c.order_id) {
    const o = liveOrder(c.order_id);
    if (['shipped','dispatched','delivered'].includes(o.fulfillment_status)) throw new CommerceError('This shipment has been handed over. You can change future renewals.');
    const s = shipment(c.order_id);
    if (s && ['booking','booking_uncertain','pickup_pending','awb_pending'].includes(s.status)) throw new CommerceError('Carrier operation needs reconciliation before this change.');
  }
}
export async function previewCycle(raw: unknown, customerId: string) {
  const p = z.object({ cycleId: z.string().uuid(), method: z.enum(['prepaid','cod']) }).strict().parse(raw);
  const c = cycle(p.cycleId), sub = plan(c.subscription_id, customerId), doc = JSON.parse(sub.document) as PlanDocument;
  mutable(c);
  if (sub.status === 'cancelled' || sub.status === 'paused') throw new CommerceError('Resume the subscription before ordering.');
  if (c.order_id && liveOrder(c.order_id).gateway_payment_id) throw new CommerceError('Payment already received. Refresh this renewal.');
  if (c.order_id && shipment(c.order_id)) throw new CommerceError('Cancel the current shipment before changing payment method.');
  const q = await createQuote({ ...doc.input, method: p.method }, owner(customerId), { customerId, policy: doc.policy, intervalDays: doc.intervalDays, dueMs: c.due_ms, cycleId: c.id, generation: c.generation + 1 });
  // This preview does not revoke an already payable checkout. Commit checks the captured state again.
  return { ...publicQuote(q), cycleId: c.id, cycleRevision: c.revision, method: p.method };
}
export async function commitCycle(raw: unknown, customerId: string) {
  const p = z.object({ quoteId: z.string().uuid(), cycleRevision: z.number().int().positive() }).strict().parse(raw), db = getDb();
  const info = db.transaction(() => {
    const q = getQuote(p.quoteId, owner(customerId)), ctx = q.subscription;
    if (!ctx?.cycleId) throw new CommerceError('Review a renewal quote.');
    const c = cycle(ctx.cycleId), sub = plan(c.subscription_id, customerId);
    // Replay of a committed request returns its existing payment/order, without replacing it.
    if (c.quote_id === q.id && ["draft","awaiting_payment","ready"].includes(c.status) && !["cancelled","paused"].includes(sub.status)) return { q, c };
    mutable(c);
    if (sub.status === 'cancelled' || sub.status === 'paused' || c.revision !== p.cycleRevision || ctx.generation !== c.generation + 1) throw new CommerceError('Renewal changed. Review its current total.');
    if (c.order_id) {
      const old = liveOrder(c.order_id);
      if (old.gateway_payment_id) throw new CommerceError('Payment already received. Refresh this renewal.');
      if (shipment(c.order_id)) throw new CommerceError('Shipment booking must be cancelled first.');
      db.prepare("UPDATE commerce_orders SET payment_status='cancelled',fulfillment_status='cancelled' WHERE id=?").run(old.id);
      releaseSubscriptionInventory(old.id);
    }
    const changed = db.prepare("UPDATE tea_subscription_cycles SET status='draft',order_id=NULL,quote_id=?,generation=?,method=?,blocked_reason='',revision=revision+1 WHERE id=? AND revision=?").run(q.id, ctx.generation!, q.input.method === 'cod' ? 'cod' : 'prepaid', c.id, c.revision);
    if (!changed.changes) throw new CommerceError('Renewal changed. Refresh and try again.');
    const doc = JSON.parse(sub.document) as PlanDocument;
    // A customer explicitly accepting a fresh total authorizes future COD only up to this amount.
    if (q.input.method === doc.input.method) doc.acceptedTotal = q.totalPaise;
    db.prepare("UPDATE tea_subscriptions SET document=?,status='active',revision=revision+1 WHERE id=?").run(JSON.stringify(doc), sub.id);
    record(sub.id, 'renewal.accepted', { quoteId: q.id, method: q.input.method, totalPaise: q.totalPaise });
    return { q, c: cycle(c.id) };
  })();
  return startPayment(info.q.id, owner(customerId), `subscription:${info.c.id}:${info.q.subscription!.generation}`);
}
export async function existingPayment(cycleId: string, customerId: string) {
  const c = cycle(cycleId); plan(c.subscription_id, customerId);
  if (!c.order_id || !c.quote_id || c.status !== 'awaiting_payment') throw new CommerceError('Review a fresh renewal quote.');
  const o = liveOrder(c.order_id);
  if (o.inventory_status === 'released' || o.reserved_until <= Date.now() || o.payment_status !== 'payment_pending') throw new CommerceError('This payment attempt expired or needs review. Request a new quote.');
  return startPayment(c.quote_id, owner(customerId), `subscription:${c.id}:${c.generation}`);
}
export async function changeSubscription(raw: unknown, customerId: string) {
  const input = actionSchema.parse(raw), db = getDb();
  const outcome = db.transaction(() => {
    const p = plan(input.id, customerId);
    if (p.revision !== input.revision || p.status === 'cancelled') throw new CommerceError('Subscription changed. Refresh and try again.');
    const c = openCycle(p.id), doc = JSON.parse(p.document) as PlanDocument;
    if (input.action === 'cancel' && !input.cancelCurrent) {
      db.prepare("UPDATE tea_subscriptions SET status='cancelled',revision=revision+1 WHERE id=? AND revision=?").run(p.id, p.revision);
      // A draft with no accepted order is a future renewal, not a current shipment obligation.
      if (c && !c.order_id) db.prepare("UPDATE tea_subscription_cycles SET status='cancelled',revision=revision+1 WHERE id=?").run(c.id);
      record(p.id, 'cancel.future'); return { pending: false };
    }
    if (input.action === 'pause') {
      db.prepare("UPDATE tea_subscriptions SET status='paused',revision=revision+1 WHERE id=? AND revision=?").run(p.id, p.revision);
      record(p.id, 'pause'); return { pending: false };
    }
    if (c) mutable(c);
    if (input.action === 'update') {
      const due = futureDate(input.dispatchDate);
      if (c?.order_id && (input.address || input.items)) throw new CommerceError('Skip the current renewal before changing its items or address.');
      doc.intervalDays = input.intervalDays; doc.input.method = input.method;
      if (input.address) doc.input.address = input.address;
      if (input.items) doc.input.items = input.items;
      // Changed terms need a new price review; do not inherit an unrelated accepted total.
      if (input.address || input.items || doc.input.method !== JSON.parse(p.document).input.method) doc.acceptedTotal = 0;
      db.prepare("UPDATE tea_subscriptions SET document=?,next_ms=?,status='active',revision=revision+1 WHERE id=?").run(JSON.stringify(doc), due, p.id);
      if (c?.order_id) db.prepare('UPDATE tea_subscription_cycles SET due_ms=?,revision=revision+1 WHERE id=?').run(due, c.id);
      else if (c) db.prepare("UPDATE tea_subscription_cycles SET due_ms=?,method=?,quote_id=NULL,generation=generation+1,revision=revision+1,status='draft' WHERE id=?").run(due, input.method, c.id);
      record(p.id, 'update', { intervalDays: input.intervalDays, nextMs: due }); return { pending: false };
    }
    const action = input.action;
    if (action === 'cancel') db.prepare("UPDATE tea_subscriptions SET status='cancelled',revision=revision+1 WHERE id=?").run(p.id);
    else db.prepare('UPDATE tea_subscriptions SET revision=revision+1 WHERE id=?').run(p.id);
    if (c) {
      db.prepare("UPDATE tea_subscription_cycles SET status='change_pending',blocked_reason=?,revision=revision+1 WHERE id=?").run(action, c.id);
      enqueue('subscription_change', { cycleId: c.id, action }, `subscription:change:${c.id}:${c.revision}`);
      record(p.id, `${action}.requested`, { cycleId: c.id });
      return { pending: true };
    }
    if (action === 'skip') db.prepare('UPDATE tea_subscriptions SET next_ms=? WHERE id=?').run(nextDispatch(p.next_ms, doc.intervalDays), p.id);
    record(p.id, action); return { pending: false };
  })();
  return outcome;
}
/** Cancel provider booking first. A timeout keeps the cycle blocked for staff reconciliation. */
export async function finishCycleChange(cycleId: string, action: 'skip' | 'cancel') {
  const c = cycle(cycleId), db = getDb();
  if (c.status !== 'change_pending') return;
  if (c.order_id) {
    const o = liveOrder(c.order_id), s = shipment(o.id);
    if (s && s.status !== 'cancelled') {
      const data = JSON.parse(s.document);
      if (!data.order_id) throw new CommerceError('Carrier booking needs staff reconciliation.');
      await shippingRequest('orders/cancel', { ids: [data.order_id] });
      db.prepare("UPDATE commerce_shipments SET status='cancelled',updated_ms=? WHERE order_id=?").run(Date.now(), o.id);
    }
    db.transaction(() => {
      const current = cycle(c.id);
      if (current.status !== 'change_pending') throw new CommerceError('Renewal changed during cancellation.');
      releaseSubscriptionInventory(o.id);
      const latest = liveOrder(o.id);
      if (!latest.gateway_payment_id) db.prepare("UPDATE commerce_orders SET payment_status='cancelled' WHERE id=?").run(o.id);
      else enqueue('subscription_refund', { orderId: o.id, cycleId: c.id }, `subscription:refund:${o.id}`);
    })();
  }
  db.transaction(() => {
    const p = plan(c.subscription_id), doc = JSON.parse(p.document) as PlanDocument;
    const result = db.prepare("UPDATE tea_subscription_cycles SET status=?,blocked_reason='',revision=revision+1 WHERE id=? AND status='change_pending'").run(action === 'skip' ? 'skipped' : 'cancelled', c.id);
    if (!result.changes) return;
    if (action === 'skip') db.prepare('UPDATE tea_subscriptions SET next_ms=?,revision=revision+1 WHERE id=?').run(nextDispatch(c.due_ms, doc.intervalDays), p.id);
    record(p.id, action, { cycleId: c.id });
  })();
}
export async function refundSubscriptionOrder(orderId: string) {
  const o = liveOrder(orderId), q = JSON.parse(o.document) as Quote;
  if (!q.subscription || o.payment_status === 'refunded') return;
  await refundOrder(orderId, q.totalMinor - o.refund_minor, `subscription-refund:${orderId}`);
}
export async function subscriptionTick() {
  const db = getDb(), policy = subscriptionPolicy();
  if (!policy.renewalsEnabled) return;
  const rows = db.prepare("SELECT id FROM tea_subscriptions WHERE status='active' AND next_ms<=? ORDER BY next_ms LIMIT 50").all(Date.now() + DAY) as { id: string }[];
  for (const row of rows) {
    const c = db.transaction(() => newCycle(plan(row.id)))();
    const p = plan(row.id), doc = JSON.parse(p.document) as PlanDocument;
    // Persistent deduped reminder links require login and never expose contact/address data.
    if (c.method !== 'cod') enqueue('subscription_email', { cycleId: c.id }, `subscription:reminder:${c.id}`);
    if (c.status === 'draft' && c.method === 'cod' && c.due_ms <= Date.now()) {
      try {
        const q = await previewCycle({ cycleId: c.id, method: 'cod' }, p.customer_id);
        if (q.totalPaise > doc.acceptedTotal) {
          db.prepare("UPDATE tea_subscriptions SET status='action_required',revision=revision+1 WHERE id=? AND status='active'").run(p.id);
          db.prepare("UPDATE tea_subscription_cycles SET blocked_reason='Please approve the updated renewal total.' WHERE id=?").run(c.id);
          enqueue('subscription_email', { cycleId: c.id }, `subscription:price:${c.id}`);
        } else await commitCycle({ quoteId: q.id, cycleRevision: q.cycleRevision }, p.customer_id);
      } catch (error) {
        const message = error instanceof CommerceError ? error.message : 'Renewal needs staff review.';
        db.prepare("UPDATE tea_subscription_cycles SET blocked_reason=? WHERE id=? AND status='draft'").run(message, c.id);
        db.prepare("UPDATE tea_subscriptions SET status='action_required',revision=revision+1 WHERE id=? AND status='active'").run(p.id);
      }
    }
    const current = cycle(c.id);
    if (current.status === 'awaiting_payment' && current.order_id) {
      const o = liveOrder(current.order_id);
      if (o.inventory_status === 'released' && !o.gateway_payment_id) db.prepare("UPDATE tea_subscription_cycles SET blocked_reason='Payment attempt expired. Review a fresh quote.' WHERE id=?").run(c.id);
    }
    if (['draft','awaiting_payment'].includes(current.status) && current.due_ms + DAY < Date.now()) {
      db.prepare("UPDATE tea_subscriptions SET status='action_required',revision=revision+1 WHERE id=? AND status='active'").run(p.id);
      db.prepare("UPDATE tea_subscription_cycles SET blocked_reason='Renewal overdue. Pay, switch to COD, skip or choose a new date.' WHERE id=?").run(c.id);
    }
  }
}
export function renewalEmailData(cycleId: string) {
  const c = cycle(cycleId), p = plan(c.subscription_id), doc = JSON.parse(p.document) as PlanDocument;
  if (['skipped','cancelled','dispatched'].includes(c.status) || p.status === 'cancelled') return null;
  return { to: doc.input.address.email, name: doc.input.address.name, cycleId: c.id, interval: doc.intervalDays, date: new Date(c.due_ms).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) };
}

/** Existing order pages use this projection, scoped to the stable authenticated customer. */
export function subscriptionOrderDetails(customerId: string, orderId: string): import('@/lib/customerOrders').CustomerOrderDossier | null {
  const row = getDb().prepare('SELECT * FROM commerce_orders WHERE id=? AND owner=?').get(orderId, owner(customerId)) as ReturnType<typeof liveOrder> | undefined;
  if (!row) return null;
  const q = JSON.parse(row.document) as Quote;
  if (!q.subscription || q.subscription.customerId !== customerId) return null;
  const a = q.input.address, c = q.subscription.cycleId ? cycle(q.subscription.cycleId) : null;
  return { id: row.id, reference: row.id.slice(0, 8).toUpperCase(), status: row.fulfillment_status === 'cancelled' ? 'cancelled' : row.payment_status, payment_status: row.payment_status, dispatch_status: row.fulfillment_status,
    total_paise: q.totalPaise, discount_paise: (q.subscriptionDiscountPaise || 0) + (q.paymentDiscountPaise || 0), tax_paise: q.taxPaise, shipping_paise: q.shippingPaise, created_at: new Date(Number(row.created_ms)).toISOString(),
    item_count: q.lines.reduce((n, l) => n + l.quantity, 0), items_summary: q.lines.map(l => `${l.name} (${l.grams}g × ${l.quantity})`).join(', '),
    items: q.lines.map((l, i) => ({ id: i + 1, productName: l.name, estate: '', flush: '', grams: l.grams, quantity: l.quantity, unitPricePaise: l.pricePaise, totalPricePaise: l.pricePaise * l.quantity, sku: l.sku })),
    is_cancellable: false, customer_name: a.name, customer_email: a.email, customer_phone: a.phone, shipping_address: [a.line1,a.line2,a.city,a.state,a.postcode,a.country].filter(Boolean).join(', '), coupon_code: null, shipping_method: 'subscription',
    cancellation_reason: c && ['cancelled','skipped','change_pending'].includes(c.status) ? c.status : null,
  };
}
export function subscriptionOrderHistory(customerId: string) {
  const rows = getDb().prepare('SELECT id FROM commerce_orders WHERE owner=? ORDER BY created_ms DESC LIMIT 100').all(owner(customerId)) as { id: string }[];
  return rows.map(r => subscriptionOrderDetails(customerId, r.id)).filter((r): r is NonNullable<typeof r> => !!r);
}
