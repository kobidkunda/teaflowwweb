import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { config, saveConfig } from '@/lib/international/store';
import { CommerceError } from '@/lib/international/models';
import { policySchema, type Plan, type Cycle } from './model';
export function subscriptionPolicy() { return policySchema.parse(config('subscriptions') || { enabled: false, renewalsEnabled: true, baseBps: 0, prepaidBps: 0, version: 1 }); }
export function saveSubscriptionPolicy(raw: unknown) {
  const p = policySchema.parse(raw);
  return getDb().transaction(() => {
    const old = subscriptionPolicy();
    if (p.version !== old.version) throw new CommerceError('Settings changed. Refresh and try again.');
    const next = { ...p, version: old.version + 1 };
    saveConfig('subscriptions', next);
    return next;
  })();
}
export function plan(id: string, customerId?: string): Plan {
  const row = (customerId ? getDb().prepare('SELECT * FROM tea_subscriptions WHERE id=? AND customer_id=?').get(id, customerId) : getDb().prepare('SELECT * FROM tea_subscriptions WHERE id=?').get(id)) as Plan | undefined;
  if (!row) throw new CommerceError('Subscription not found.');
  return { ...row, next_ms: Number(row.next_ms), created_ms: Number(row.created_ms) };
}
export function cycle(id: string): Cycle {
  const row = getDb().prepare('SELECT * FROM tea_subscription_cycles WHERE id=?').get(id) as Cycle | undefined;
  if (!row) throw new CommerceError('Renewal not found.');
  return { ...row, due_ms: Number(row.due_ms), lease_ms: Number(row.lease_ms), created_ms: Number(row.created_ms) };
}
export function openCycle(id: string): Cycle | null {
  const row = getDb().prepare("SELECT id FROM tea_subscription_cycles WHERE subscription_id=? AND status IN ('draft','awaiting_payment','ready','dispatching','change_pending','exception')").get(id) as { id: string } | undefined;
  return row ? cycle(row.id) : null;
}
export function record(id: string, action: string, document: unknown = {}) {
  getDb().prepare('INSERT INTO tea_subscription_events(id,subscription_id,action,document,created_ms) VALUES (?,?,?,?,?)').run(randomUUID(), id, action, JSON.stringify(document), Date.now());
}
export function subscriptionList(customerId?: string) {
  const rows = (customerId ? getDb().prepare('SELECT id FROM tea_subscriptions WHERE customer_id=? ORDER BY created_ms DESC LIMIT 200').all(customerId) : getDb().prepare('SELECT id FROM tea_subscriptions ORDER BY created_ms DESC LIMIT 200').all()) as { id: string }[];
  return rows.map(r => {
    const p = plan(r.id); const doc = JSON.parse(p.document);
    const cycles = (getDb().prepare('SELECT id FROM tea_subscription_cycles WHERE subscription_id=? ORDER BY sequence DESC LIMIT 20').all(p.id) as { id: string }[]).map(r => {
      const c = cycle(r.id);
      const order = c.order_id ? getDb().prepare('SELECT payment_status,fulfillment_status,refund_minor,document FROM commerce_orders WHERE id=?').get(c.order_id) as { payment_status: string; fulfillment_status: string; refund_minor: number; document: string } : null;
      const q = order ? JSON.parse(order.document) : null;
      return { ...c, paymentStatus: order?.payment_status || '', fulfillmentStatus: order?.fulfillment_status || '', refundMinor: Number(order?.refund_minor || 0), totalPaise: q?.totalPaise, lines: q?.lines, paymentUrl: `/account/subscriptions?renewal=${c.id}` };
    });
    return { id: p.id, status: p.status, nextMs: p.next_ms, revision: p.revision, ...doc, cycles };
  });
}
