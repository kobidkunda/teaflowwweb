import { subscriptionOrderDetails, subscriptionOrderHistory } from "@/lib/subscriptions/service";
import { releaseTrialReservations } from "@/lib/subscriptions/trialInventory";
import { getDb } from "@/lib/db";
import { formatINR } from "@/lib/money";

export type CustomerOrderItem = {
  id: number;
  productName: string;
  estate: string;
  flush: string;
  grams: number;
  quantity: number;
  unitPricePaise: number;
  totalPricePaise: number;
  sku?: string;
  image?: string;
};

export type CustomerOrderSummary = {
  id: string;
  reference: string;
  status: string;
  payment_status: string;
  dispatch_status: string;
  total_paise: number;
  discount_paise: number;
  tax_paise: number;
  shipping_paise: number;
  created_at: string;
  item_count: number;
  items_summary: string;
  items: CustomerOrderItem[];
  is_cancellable: boolean;
};

export type CustomerOrderDossier = CustomerOrderSummary & {
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address: string;
  coupon_code: string | null;
  shipping_method: string;
  cancellation_reason?: string | null;
  tracking?: {
    carrier?: string;
    awb?: string;
    status?: string;
    estimatedDelivery?: string;
  } | null;
};

export class CustomerOrderError extends Error {
  constructor(message: string, public code = 400) {
    super(message);
    this.name = "CustomerOrderError";
  }
}

/**
 * Checks if an order can be self-service cancelled by the customer.
 */
export function isOrderCancellable(status: string, dispatchStatus: string): boolean {
  const normDispatch = (dispatchStatus || "unfulfilled").toLowerCase();
  const normStatus = (status || "").toLowerCase();

  if (normDispatch === "cancelled" || normDispatch === "shipped" || normDispatch === "delivered" || normDispatch === "returned") {
    return false;
  }
  if (normStatus === "cancelled" || normStatus === "refunded") {
    return false;
  }
  return true;
}

/**
 * Hydrates line items for an order from order_items.
 */
function getOrderItems(db: ReturnType<typeof getDb>, orderId: string): CustomerOrderItem[] {
  try {
    const rows = db
      .prepare(
        `SELECT oi.id, oi.quantity, oi.unit_price_paise, v.grams, v.sku,
                p.name as product_name, p.estate, p.flush,
                (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
         FROM order_items oi
         JOIN variants v ON v.id = oi.variant_id
         JOIN products p ON p.id = v.product_id
         WHERE oi.order_id = ?`
      )
      .all(orderId) as {
        id: number;
        quantity: number;
        unit_price_paise: number;
        grams: number;
        sku: string;
        product_name: string;
        estate: string;
        flush: string;
        primary_image: string | null;
      }[];

    return rows.map((r) => ({
      id: r.id,
      productName: r.product_name,
      estate: r.estate,
      flush: r.flush,
      grams: r.grams,
      quantity: r.quantity,
      unitPricePaise: r.unit_price_paise,
      totalPricePaise: r.unit_price_paise * r.quantity,
      sku: r.sku,
      image: r.primary_image || "/images/teafloww-default-pack.svg",
    }));
  } catch {
    return [];
  }
}

type CommerceOrderLine = {
  name?: string;
  variantId?: number;
  trialId?: string;
  quantity?: number;
  pricePaise?: number;
  grams?: number;
  sku?: string;
};

type CommerceOrderDoc = {
  totalPaise?: number;
  totalMinor?: number;
  discountPaise?: number;
  paymentDiscountPaise?: number;
  taxPaise?: number;
  shippingPaise?: number;
  components?: {
    shipping?: number;
  };
  lines?: CommerceOrderLine[];
  input?: {
    method?: string;
    coupon?: string | null;
    address?: {
      name?: string;
      email?: string;
      phone?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postcode?: string;
      country?: string;
    };
  };
};

/**
 * Hydrates line items for a commerce_orders document lines array.
 */
function getCommerceOrderItems(db: ReturnType<typeof getDb>, lines: CommerceOrderLine[]): CustomerOrderItem[] {
  if (!Array.isArray(lines)) return [];
  return lines.map((l, idx: number) => {
    let productName = l.name || "Single-Estate Himalayan Tea";
    let estate = "Himalayan Foothills";
    let flush = "Direct-from-Origin";
    let image = "/images/teafloww-default-pack.svg";
    let grams = Number(l.grams || 100);
    let sku = l.sku || "";

    if (l.variantId && Number(l.variantId) > 0) {
      try {
        const prod = db
          .prepare(
            `SELECT p.name as product_name, p.estate, p.flush, v.grams, v.sku,
                    (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
             FROM variants v
             JOIN products p ON p.id = v.product_id
             WHERE v.id = ?`
          )
          .get(l.variantId) as {
            product_name: string;
            estate: string;
            flush: string;
            grams: number;
            sku: string;
            primary_image: string | null;
          } | undefined;
        if (prod) {
          productName = prod.product_name;
          estate = prod.estate || estate;
          flush = prod.flush || flush;
          if (prod.primary_image) image = prod.primary_image;
          if (prod.grams) grams = prod.grams;
          if (prod.sku) sku = prod.sku;
        }
      } catch {}
    } else if (l.trialId) {
      try {
        const trial = db
          .prepare("SELECT title, subtitle FROM trial_kits WHERE id = ?")
          .get(l.trialId) as { title: string; subtitle: string } | undefined;
        if (trial) {
          productName = trial.title;
          estate = "Darjeeling & Assam Estates";
          flush = trial.subtitle || "Tasting Atelier";
        }
      } catch {}
    }

    return {
      id: idx + 1,
      productName,
      estate,
      flush,
      grams,
      quantity: Number(l.quantity || 1),
      unitPricePaise: Number(l.pricePaise || 0),
      totalPricePaise: Number(l.pricePaise || 0) * Number(l.quantity || 1),
      sku,
      image,
    };
  });
}

function hydrateCommerceOrderSummary(
  db: ReturnType<typeof getDb>,
  row: { id: string; owner: string; document: string; payment_status: string; fulfillment_status: string; created_ms: number }
): CustomerOrderSummary {
  let doc: CommerceOrderDoc = {};
  try {
    doc = JSON.parse(row.document) as CommerceOrderDoc;
  } catch {}

  const lines = Array.isArray(doc.lines) ? doc.lines : [];
  const items = getCommerceOrderItems(db, lines);
  const itemCount = items.reduce((sum, it) => sum + it.quantity, 0) || 1;
  const itemsSummary = items.length > 0
    ? items.map((it) => `${it.productName} (${it.grams}g × ${it.quantity})`).join(", ")
    : "Single-Estate Selection";

  const isConfirmed = row.payment_status === "paid" || row.payment_status === "cod_due" || row.payment_status === "cod_remitted";
  const isCancelled = row.fulfillment_status === "cancelled" || row.payment_status === "cancelled";
  const status = isCancelled ? "cancelled" : isConfirmed ? "confirmed" : row.payment_status;
  const dispatchStatus = row.fulfillment_status || "unfulfilled";

  return {
    id: row.id,
    reference: row.id.slice(0, 8).toUpperCase(),
    status,
    payment_status: row.payment_status,
    dispatch_status: dispatchStatus,
    total_paise: Number(doc.totalPaise ?? doc.totalMinor ?? 0),
    discount_paise: Number(doc.discountPaise ?? 0) + Number(doc.paymentDiscountPaise ?? 0),
    tax_paise: Number(doc.taxPaise ?? 0),
    shipping_paise: Number(doc.shippingPaise ?? doc.components?.shipping ?? 0),
    created_at: new Date(Number(row.created_ms)).toISOString(),
    item_count: itemCount,
    items_summary: itemsSummary,
    items,
    is_cancellable: isOrderCancellable(status, dispatchStatus),
  };
}

function hydrateCommerceOrderDossier(
  db: ReturnType<typeof getDb>,
  row: { id: string; owner: string; document: string; payment_status: string; fulfillment_status: string; created_ms: number }
): CustomerOrderDossier {
  const summary = hydrateCommerceOrderSummary(db, row);
  let doc: CommerceOrderDoc = {};
  try {
    doc = JSON.parse(row.document) as CommerceOrderDoc;
  } catch {}

  const addr = doc.input?.address || {};
  const addrParts = [addr.line1, addr.line2, addr.city, addr.state, addr.postcode, addr.country].filter(Boolean);
  const shippingAddress = addrParts.length > 0 ? addrParts.join(", ") : "Heritage Tea Estate, Siliguri, West Bengal";

  const method = doc.input?.method || "standard";
  const shippingMethod = method === "cod" ? "Cash on Delivery (Siliguri Hub Dispatch)" : method === "upi" ? "UPI Instant Express" : "Courier Express";

  let tracking: CustomerOrderDossier["tracking"] = {
    carrier: "Shiprocket Express",
    status: summary.dispatch_status === "shipped" ? "In Transit" : summary.dispatch_status,
    estimatedDelivery: "3–5 business days from Siliguri Hub",
  };

  try {
    const shipment = db.prepare("SELECT document, status FROM commerce_shipments WHERE order_id = ?").get(row.id) as { document: string; status: string } | undefined;
    if (shipment) {
      const sDoc = JSON.parse(shipment.document);
      tracking = {
        carrier: sDoc.awb?.courier_name || "Shiprocket Express",
        awb: sDoc.awb?.awb_code,
        status: sDoc.publicTracking?.status || shipment.status,
        estimatedDelivery: sDoc.pickup?.pickup_scheduled_date ? `Dispatched ${sDoc.pickup.pickup_scheduled_date}` : "3–5 business days",
      };
    }
  } catch {}

  return {
    ...summary,
    customer_name: addr.name || "Tea Connoisseur",
    customer_email: addr.email || "",
    customer_phone: addr.phone || null,
    shipping_address: shippingAddress,
    coupon_code: doc.input?.coupon || null,
    shipping_method: shippingMethod,
    tracking,
  };
}

/**
 * List all orders for a customer (by customer_id, email, or phone).
 */
export function listCustomerOrders(
  customerId: string,
  email: string,
  phone?: string | null
): CustomerOrderSummary[] {
  const db = getDb();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone?.trim();
  const phoneDigits = cleanPhone ? cleanPhone.replace(/\D/g, "").slice(-10) : "";

  // 1. Query legacy orders table
  let query = `
    SELECT id, customer_id, customer_name, customer_email, customer_phone,
           total_paise, discount_paise, tax_paise, shipping_paise,
           status, COALESCE(payment_status, 'unpaid') as payment_status,
           COALESCE(dispatch_status, 'unfulfilled') as dispatch_status,
           created_at
    FROM orders
    WHERE customer_id = ? OR LOWER(customer_email) = ?
  `;
  const params: (string | number)[] = [customerId, cleanEmail];

  if (cleanPhone) {
    query += ` OR (customer_phone IS NOT NULL AND customer_phone = ?)`;
    params.push(cleanPhone);
  }

  query += ` ORDER BY created_at DESC LIMIT 50`;

  let legacy: CustomerOrderSummary[] = [];
  try {
    const rows = db.prepare(query).all(...params) as {
      id: string;
      customer_id: string | null;
      customer_name: string;
      customer_email: string;
      customer_phone: string | null;
      total_paise: number;
      discount_paise: number;
      tax_paise: number;
      shipping_paise: number;
      status: string;
      payment_status: string;
      dispatch_status: string;
      created_at: string;
    }[];

    legacy = rows.map((r) => {
      const items = getOrderItems(db, r.id);
      const itemCount = items.reduce((sum, it) => sum + it.quantity, 0) || 1;
      const itemsSummary = items.length > 0
        ? items.map((it) => `${it.productName} (${it.grams}g × ${it.quantity})`).join(", ")
        : "Single-Estate Selection";

      return {
        id: r.id,
        reference: r.id.slice(0, 8).toUpperCase(),
        status: r.status,
        payment_status: r.payment_status,
        dispatch_status: r.dispatch_status,
        total_paise: r.total_paise,
        discount_paise: r.discount_paise || 0,
        tax_paise: r.tax_paise || 0,
        shipping_paise: r.shipping_paise || 0,
        created_at: r.created_at,
        item_count: itemCount,
        items_summary: itemsSummary,
        items,
        is_cancellable: isOrderCancellable(r.status, r.dispatch_status),
      };
    });
  } catch {}

  // 2. Query commerce_orders table
  const commOrders: CustomerOrderSummary[] = [];
  try {
    const commRows = db
      .prepare(
        `SELECT id, owner, document, payment_status, fulfillment_status, created_ms
         FROM commerce_orders
         ORDER BY created_ms DESC
         LIMIT 200`
      )
      .all() as {
        id: string;
        owner: string;
        document: string;
        payment_status: string;
        fulfillment_status: string;
        created_ms: number;
      }[];

    for (const cr of commRows) {
      let doc: CommerceOrderDoc = {};
      try {
        doc = JSON.parse(cr.document) as CommerceOrderDoc;
      } catch {
        continue;
      }

      const orderEmail = (doc.input?.address?.email || "").trim().toLowerCase();
      const orderPhone = (doc.input?.address?.phone || "").replace(/\D/g, "").slice(-10);

      const matchesEmail = Boolean(cleanEmail && orderEmail === cleanEmail);
      const matchesPhone = Boolean(phoneDigits && phoneDigits.length >= 10 && orderPhone === phoneDigits);
      const matchesOwner = Boolean(cr.owner === customerId);

      if (!matchesEmail && !matchesPhone && !matchesOwner) {
        continue;
      }

      // Only include confirmed/real orders (filter out abandoned/unpaid draft checkout sessions)
      const isConfirmed =
        ["paid", "cod_due", "cod_remitted", "refunded", "partially_refunded", "cancelled"].includes(cr.payment_status) ||
        ["preparing", "dispatched", "shipped", "delivered", "cancelled"].includes(cr.fulfillment_status);

      if (!isConfirmed) continue;

      commOrders.push(hydrateCommerceOrderSummary(db, cr));
    }
  } catch {}

  const allOrders = [...commOrders, ...legacy, ...subscriptionOrderHistory(customerId)];
  const seen = new Set<string>();
  const uniqueOrders: CustomerOrderSummary[] = [];
  for (const o of allOrders) {
    if (o && !seen.has(o.id)) {
      seen.add(o.id);
      uniqueOrders.push(o);
    }
  }

  uniqueOrders.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return uniqueOrders.slice(0, 100);
}

/**
 * Get full order details for an authenticated customer.
 */
export function getCustomerOrderDetails(
  customerId: string,
  email: string,
  phone: string | null | undefined,
  orderId: string
): CustomerOrderDossier {
  const db = getDb();
  const rawId = orderId.trim();
  const cleanId = rawId.replace(/^TF-/i, "").trim();

  const renewal = subscriptionOrderDetails(customerId, cleanId) || subscriptionOrderDetails(customerId, rawId);
  if (renewal) return renewal;

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone?.trim();
  const phoneDigits = cleanPhone ? cleanPhone.replace(/\D/g, "").slice(-10) : "";

  // 1. Try legacy orders table
  try {
    const row = db
      .prepare(
        `SELECT * FROM orders
         WHERE (id = ? OR id = ? OR (LENGTH(?) >= 8 AND (id LIKE ? OR id LIKE ?)))
           AND (customer_id = ? OR LOWER(customer_email) = ? OR (customer_phone IS NOT NULL AND customer_phone = ?))`
      )
      .get(cleanId, rawId, cleanId, cleanId + "%", rawId + "%", customerId, cleanEmail, cleanPhone || "") as Record<string, unknown> | undefined;

    if (row) {
      const items = getOrderItems(db, String(row.id));
      const itemCount = items.reduce((sum, it) => sum + it.quantity, 0) || 1;
      const itemsSummary = items.length > 0
        ? items.map((it) => `${it.productName} (${it.grams}g × ${it.quantity})`).join(", ")
        : "Single-Estate Selection";

      const status = String(row.status || "demo_unpaid");
      const dispatchStatus = String(row.dispatch_status || "unfulfilled");

      return {
        id: String(row.id),
        reference: String(row.id).slice(0, 8).toUpperCase(),
        status,
        payment_status: String(row.payment_status || "unpaid"),
        dispatch_status: dispatchStatus,
        total_paise: Number(row.total_paise || 0),
        discount_paise: Number(row.discount_paise || 0),
        tax_paise: Number(row.tax_paise || 0),
        shipping_paise: Number(row.shipping_paise || 0),
        created_at: String(row.created_at || ""),
        customer_name: String(row.customer_name || ""),
        customer_email: String(row.customer_email || ""),
        customer_phone: (row.customer_phone as string) || null,
        shipping_address: String(row.shipping_address || ""),
        coupon_code: (row.coupon_code as string) || null,
        shipping_method: String(row.shipping_method || "standard"),
        item_count: itemCount,
        items_summary: itemsSummary,
        items,
        is_cancellable: isOrderCancellable(status, dispatchStatus),
        tracking: {
          carrier: "Shiprocket Express",
          status: dispatchStatus === "shipped" ? "In Transit" : dispatchStatus,
          estimatedDelivery: "3–5 business days from Siliguri Hub",
        },
      };
    }
  } catch {}

  // 2. Try commerce_orders table
  try {
    const commRow = db
      .prepare(
        `SELECT id, owner, document, payment_status, fulfillment_status, created_ms
         FROM commerce_orders
         WHERE id = ? OR id = ? OR (LENGTH(?) >= 8 AND id LIKE ?)
         ORDER BY created_ms DESC LIMIT 1`
      )
      .get(cleanId, cleanId.toLowerCase(), cleanId, cleanId.toLowerCase() + "%") as {
        id: string;
        owner: string;
        document: string;
        payment_status: string;
        fulfillment_status: string;
        created_ms: number;
      } | undefined;

    if (commRow) {
      let doc: CommerceOrderDoc = {};
      try {
        doc = JSON.parse(commRow.document) as CommerceOrderDoc;
      } catch {}

      const orderEmail = (doc.input?.address?.email || "").trim().toLowerCase();
      const orderPhone = (doc.input?.address?.phone || "").replace(/\D/g, "").slice(-10);

      const matchesEmail = Boolean(cleanEmail && orderEmail === cleanEmail);
      const matchesPhone = Boolean(phoneDigits && phoneDigits.length >= 10 && orderPhone === phoneDigits);
      const matchesOwner = Boolean(commRow.owner === customerId);

      if (matchesEmail || matchesPhone || matchesOwner) {
        return hydrateCommerceOrderDossier(db, commRow);
      }
    }
  } catch {}

  throw new CustomerOrderError("Order not found or access denied.", 404);
}

/**
 * Customer Self-Service Order Cancellation.
 */
export function cancelCustomerOrder(
  customerId: string,
  email: string,
  phone: string | null | undefined,
  orderId: string,
  reason: string
): CustomerOrderDossier {
  const db = getDb();
  const dossier = getCustomerOrderDetails(customerId, email, phone, orderId);

  if (!dossier.is_cancellable) {
    if (dossier.dispatch_status === "shipped") {
      throw new CustomerOrderError(
        "This order has already been dispatched from Siliguri and cannot be cancelled mid-transit. You can initiate a return within 7 days of delivery.",
        400
      );
    }
    if (dossier.dispatch_status === "delivered") {
      throw new CustomerOrderError("Delivered orders cannot be cancelled.", 400);
    }
    throw new CustomerOrderError("This order is no longer eligible for cancellation.", 400);
  }

  return db.transaction(() => {
    const isLegacy = db.prepare("SELECT id FROM orders WHERE id = ?").get(dossier.id);

    if (isLegacy) {
      // 1. Restock items back to variants inventory
      try {
        const items = db
          .prepare("SELECT variant_id, quantity FROM order_items WHERE order_id = ?")
          .all(dossier.id) as { variant_id: number; quantity: number }[];

        for (const item of items) {
          db.prepare("UPDATE variants SET stock = stock + ? WHERE id = ?").run(
            item.quantity,
            item.variant_id
          );
        }
      } catch {}

      // 2. Transition order status
      const note = `Cancelled by customer on ${new Date().toISOString()}. Reason: ${reason.slice(0, 200)}`;
      db.prepare(
        `UPDATE orders
         SET dispatch_status = 'cancelled',
             status = 'cancelled',
             admin_notes = CASE WHEN admin_notes = '' THEN ? ELSE admin_notes || ' | ' || ? END
         WHERE id = ?`
      ).run(note, note, dossier.id);

      // 3. Log event into payment_events
      try {
        db.prepare(
          "INSERT INTO payment_events (order_id, from_status, to_status, actor) VALUES (?, ?, ?, ?)"
        ).run(dossier.id, dossier.dispatch_status, "cancelled", `customer:${customerId}`);
      } catch {}
    } else {
      // commerce_orders cancellation
      db.prepare(
        "UPDATE commerce_orders SET payment_status = 'cancelled', fulfillment_status = 'cancelled', inventory_status = 'released', reserved_until = 0 WHERE id = ?"
      ).run(dossier.id);

      try {
        const lines = db
          .prepare("SELECT variant_id, quantity FROM commerce_reservations WHERE order_id = ?")
          .all(dossier.id) as { variant_id: number; quantity: number }[];
        for (const line of lines) {
          if (line.variant_id > 0) {
            db.prepare("UPDATE variants SET stock = stock + ? WHERE id = ?").run(line.quantity, line.variant_id);
          }
        }
      } catch {}

      try {
        releaseTrialReservations(dossier.id);
      } catch {}

      try {
        const hold = db.prepare("SELECT code FROM commerce_coupon_holds WHERE order_id = ?").get(dossier.id) as { code: string } | undefined;
        if (hold) {
          db.prepare("UPDATE coupons SET used_count = CASE WHEN used_count > 0 THEN used_count - 1 ELSE 0 END WHERE code = ?").run(hold.code);
          db.prepare("DELETE FROM commerce_coupon_holds WHERE order_id = ?").run(dossier.id);
        }
      } catch {}

      try {
        db.prepare(
          "INSERT INTO commerce_events (id, kind, document, created_ms) VALUES (?, 'order.cancel', ?, ?)"
        ).run(
          `cancel:${dossier.id}:${Date.now()}`,
          JSON.stringify({ orderId: dossier.id, reason: reason.slice(0, 200), actor: `customer:${customerId}` }),
          Date.now()
        );
      } catch {}
    }

    return getCustomerOrderDetails(customerId, email, phone, dossier.id);
  })();
}

