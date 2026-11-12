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
export type SubscriptionListOptions = {
  customerId?: string;
  status?: string;
  intervalDays?: number;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type PaginatedSubscriptionsResult = {
  subscriptions: Array<ReturnType<typeof hydrateSubscriptionDetails>>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

export function hydrateSubscriptionDetails(id: string) {
  const p = plan(id);
  const doc = JSON.parse(p.document);
  const cycles = (getDb().prepare('SELECT id FROM tea_subscription_cycles WHERE subscription_id=? ORDER BY sequence DESC LIMIT 20').all(p.id) as { id: string }[]).map(r => {
    const c = cycle(r.id);
    const order = c.order_id ? getDb().prepare('SELECT payment_status,fulfillment_status,refund_minor,document FROM commerce_orders WHERE id=?').get(c.order_id) as { payment_status: string; fulfillment_status: string; refund_minor: number; document: string } : null;
    const q = order ? JSON.parse(order.document) : null;
    return { ...c, paymentStatus: order?.payment_status || '', fulfillmentStatus: order?.fulfillment_status || '', refundMinor: Number(order?.refund_minor || 0), totalPaise: q?.totalPaise, lines: q?.lines, paymentUrl: `/account/subscriptions?renewal=${c.id}` };
  });
  return { id: p.id, customerId: p.customer_id, status: p.status, nextMs: p.next_ms, revision: p.revision, createdMs: p.created_ms, ...doc, cycles };
}

export function subscriptionListPaginated(opts: SubscriptionListOptions = {}): PaginatedSubscriptionsResult {
  const db = getDb();
  const page = Math.max(1, Number(opts.page) || 1);
  const pageSize = Math.min(Math.max(Number(opts.pageSize) || 20, 1), 100);

  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (opts.customerId) {
    clauses.push("customer_id = ?");
    params.push(opts.customerId);
  }
  if (opts.status && opts.status !== "all") {
    clauses.push("status = ?");
    params.push(opts.status);
  }
  if (opts.q && opts.q.trim()) {
    const term = "%" + opts.q.trim().slice(0, 60) + "%";
    clauses.push("(id LIKE ? OR customer_id LIKE ? OR document LIKE ?)");
    params.push(term, term, term);
  }

  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";

  let rows: Array<{ id: string; created_ms: number; document: string }> = [];
  try {
    rows = db.prepare("SELECT id, created_ms, document FROM tea_subscriptions" + where + " ORDER BY created_ms DESC").all(...params) as typeof rows;
  } catch {
    rows = [];
  }

  if (opts.intervalDays && opts.intervalDays > 0) {
    rows = rows.filter((r) => {
      try {
        const doc = JSON.parse(r.document);
        return doc.intervalDays === opts.intervalDays;
      } catch {
        return false;
      }
    });
  }

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageSlice = rows.slice(startIndex, startIndex + pageSize);

  const subscriptions = pageSlice.map((r) => hydrateSubscriptionDetails(r.id));

  return {
    subscriptions,
    total,
    page: currentPage,
    pageSize,
    totalPages,
    pagination: {
      total,
      page: currentPage,
      pageSize,
      totalPages,
    },
  };
}

export function subscriptionList(customerId?: string) {
  const res = subscriptionListPaginated({ customerId, pageSize: 200 });
  return res.subscriptions;
}
