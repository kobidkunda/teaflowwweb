import { getDb } from "@/lib/db";
export type OrderItem = { variant_id: number; quantity: number; unit_price_paise: number; sku?: string };
export type Order = {
  id: string; customer_name: string; customer_email: string; shipping_address: string;
  subtotal_paise: number; shipping_paise: number; discount_paise: number; total_paise: number;
  coupon_code: string | null; status: string; payment_status: string; dispatch_status: string;
  created_at: string; items: OrderItem[];
};
export class OrderTransitionError extends Error {}
const DISPATCH_NEXT: Record<string, string[]> = {
  unfulfilled: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: [],
  cancelled: [],
  returned: [],
};
function hydrate(row: Record<string, unknown>): Order {
  const db = getDb();
  const items = db.prepare(
    "SELECT oi.variant_id, oi.quantity, oi.unit_price_paise, v.sku FROM order_items oi LEFT JOIN variants v ON v.id=oi.variant_id WHERE oi.order_id=?"
  ).all(row.id) as OrderItem[];
  return { ...(row as unknown as Omit<Order, "items">), items };
}
function hydrateCommerceOrder(row: { id: string; document: string; payment_status: string; fulfillment_status: string; created_ms: number }): Order {
  try {
    const q = JSON.parse(row.document);
    const a = q?.input?.address || {};
    const addressStr = `${a.name || "Customer"}, ${a.line1 || ""}${a.line2 ? ", " + a.line2 : ""}, ${a.city || ""}, ${a.state || ""} - ${a.postcode || ""}, ${a.country || "IN"}`;
    return {
      id: row.id,
      customer_name: a.name || "Customer",
      customer_email: a.email || "customer@example.com",
      shipping_address: addressStr,
      subtotal_paise: Number(q.subtotalPaise || 0),
      shipping_paise: Number(q.shippingPaise || 0),
      discount_paise: Number(q.discountPaise || 0),
      total_paise: Number(q.totalPaise || 0),
      coupon_code: q?.input?.coupon || null,
      status: row.payment_status,
      payment_status: row.payment_status,
      dispatch_status: row.fulfillment_status || "unfulfilled",
      created_at: new Date(Number(row.created_ms)).toISOString(),
      items: (q.lines || []).map((l: { variantId: number; quantity: number; pricePaise: number; sku?: string }) => ({
        variant_id: l.variantId,
        quantity: l.quantity,
        unit_price_paise: l.pricePaise,
        sku: l.sku,
      })),
    };
  } catch {
    return {
      id: row.id,
      customer_name: "Customer",
      customer_email: "customer@example.com",
      shipping_address: "Address unavailable",
      subtotal_paise: 0,
      shipping_paise: 0,
      discount_paise: 0,
      total_paise: 0,
      coupon_code: null,
      status: row.payment_status,
      payment_status: row.payment_status,
      dispatch_status: row.fulfillment_status || "unfulfilled",
      created_at: new Date(Number(row.created_ms)).toISOString(),
      items: [],
    };
  }
}
export function getOrder(id: string): Order | null {
  const db = getDb();
  const row = db.prepare("SELECT *, COALESCE(discount_paise,0) AS discount_paise FROM orders WHERE id=?").get(id) as Record<string, unknown> | undefined;
  if (row) return hydrate(row);

  try {
    const cRow = db.prepare("SELECT id, document, payment_status, fulfillment_status, created_ms FROM commerce_orders WHERE id=?").get(id) as {
      id: string;
      document: string;
      payment_status: string;
      fulfillment_status: string;
      created_ms: number;
    } | undefined;
    if (cRow) return hydrateCommerceOrder(cRow);
  } catch {}

  return null;
}
export function listOrders(opts: { paymentStatus?: string; dispatchStatus?: string; q?: string; limit?: number; cursor?: string } = {}): Order[] {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts.paymentStatus) { clauses.push("payment_status = ?"); params.push(opts.paymentStatus); }
  if (opts.dispatchStatus) { clauses.push("dispatch_status = ?"); params.push(opts.dispatchStatus); }
  if (opts.q) { clauses.push("(id LIKE ? OR customer_email LIKE ?)"); params.push("%" + opts.q.slice(0, 60) + "%", "%" + opts.q.slice(0, 60) + "%"); }
  if (opts.cursor) { clauses.push("created_at < (SELECT created_at FROM orders WHERE id=?)"); params.push(opts.cursor); }
  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const rows = getDb().prepare("SELECT *, COALESCE(discount_paise,0) AS discount_paise FROM orders" + where + " ORDER BY created_at DESC LIMIT ?").all(...params, limit) as Record<string, unknown>[];
  const list = rows.map(hydrate);

  // Also include commerce_orders if not present
  try {
    const cRows = getDb().prepare("SELECT id, document, payment_status, fulfillment_status, created_ms FROM commerce_orders ORDER BY created_ms DESC LIMIT ?").all(limit) as Array<{
      id: string;
      document: string;
      payment_status: string;
      fulfillment_status: string;
      created_ms: number;
    }>;
    const existingIds = new Set(list.map(o => o.id));
    for (const c of cRows) {
      if (!existingIds.has(c.id)) {
        const hyd = hydrateCommerceOrder(c);
        if (opts.paymentStatus && hyd.payment_status !== opts.paymentStatus) continue;
        if (opts.dispatchStatus && hyd.dispatch_status !== opts.dispatchStatus) continue;
        if (opts.q && !hyd.id.includes(opts.q) && !hyd.customer_email.includes(opts.q)) continue;
        list.push(hyd);
      }
    }
  } catch {}

  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return list.slice(0, limit);
}
// Service-enforced dispatch state machine; audit row in the same transaction.
export function setDispatchStatus(orderId: string, to: string, actor = "admin"): Order {
  const db = getDb();
  return db.transaction(() => {
    let row = db.prepare("SELECT *, COALESCE(payment_status,'unpaid') AS payment_status, COALESCE(dispatch_status,'unfulfilled') AS dispatch_status FROM orders WHERE id=?").get(orderId) as Record<string, string> | undefined;
    let isCommerceOrder = false;
    if (!row) {
      const c = db.prepare("SELECT id, payment_status, fulfillment_status AS dispatch_status FROM commerce_orders WHERE id=?").get(orderId) as Record<string, string> | undefined;
      if (c) {
        row = c;
        isCommerceOrder = true;
      }
    }
    if (!row) throw new OrderTransitionError("Order not found.");
    const from = row.dispatch_status || "unfulfilled";
    if (from === to) return getOrder(orderId)!;
    if (!DISPATCH_NEXT[from]?.includes(to)) throw new OrderTransitionError("Transition from " + from + " to " + to + " is not allowed.");
    // Stock is decremented only at verified paid capture and restored only on
    // gateway refund — cancelling a paid order would strand the reservation, so
    // paid orders must go through the refund path instead.
    if (to === "cancelled" && row.payment_status === "paid") {
      throw new OrderTransitionError("Paid orders must be refunded through the payment gateway, not cancelled.");
    }
    if ((to === "shipped" || to === "delivered") && row.payment_status !== "paid" && row.payment_status !== "cod_due" && row.payment_status !== "cod_remitted") {
      throw new OrderTransitionError("Dispatch beyond preparing requires a paid order.");
    }
    if (isCommerceOrder) {
      db.prepare("UPDATE commerce_orders SET fulfillment_status=? WHERE id=?").run(to, orderId);
    } else {
      db.prepare("UPDATE orders SET dispatch_status=? WHERE id=?").run(to, orderId);
    }
    db.prepare("INSERT INTO payment_events (order_id, from_status, to_status, actor) VALUES (?,?,?,?)").run(orderId, from, to, actor);
    return getOrder(orderId)!;
  })();
}
export function cancelOrder(orderId: string, actor = "admin"): Order {
  const cur = getOrder(orderId);
  if (!cur) throw new OrderTransitionError("Order not found.");
  if (cur.dispatch_status === "delivered") throw new OrderTransitionError("Delivered orders cannot be cancelled.");
  return setDispatchStatus(orderId, "cancelled", actor);
}
// ---- MCP/admin shared surface aliases (same SQL owner, no forks) ----
export const getOrderFull = getOrder;
export function setDispatchStatusTx(args: { orderId: string; to: string; idempotencyKey?: string; actor?: string }): { order: Order; deduped: boolean } {
  const { orderId, to, idempotencyKey, actor } = args;
  if (!idempotencyKey) return { order: setDispatchStatus(orderId, to, actor ?? "admin"), deduped: false };
  const db = getDb();
  const prior = db.prepare("SELECT response FROM admin_idempotency WHERE key=?").get(idempotencyKey) as { response: string } | undefined;
  if (prior) return { order: JSON.parse(prior.response) as Order, deduped: true };
  const order = setDispatchStatus(orderId, to, actor ?? "admin");
  db.prepare("INSERT OR IGNORE INTO admin_idempotency (key, resource, response) VALUES (?,?,?)").run(idempotencyKey, "dispatch", JSON.stringify(order));
  return { order, deduped: false };
}
