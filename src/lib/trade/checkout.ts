import { randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { recordPaymentIntent } from "@/lib/payments";
import { enabledProductCondition } from "@/lib/productAvailability";
import {
  ReorderReminderRequestSchema,
  TradeCheckoutRequestSchema,
  type Handover,
  type QuoteLineSnapshot,
} from "./contracts";

export class TradeCheckoutError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code:
      | "invalid_request"
      | "quote_not_found"
      | "quote_forbidden"
      | "quote_expired"
      | "quote_already_used"
      | "quote_stale"
      | "insufficient_stock"
      | "lane_disabled"
      | "payment_unavailable" = "invalid_request"
  ) {
    super(message);
  }
}

export function createTradeOrderFromQuote(rawInput: unknown, sessionId: string) {
  const input = TradeCheckoutRequestSchema.parse(rawInput);
  const db = getDb();

  const result = db.transaction(() => {
    // 1. Idempotency check
    const existingOrder = db
      .prepare("SELECT id, total_paise, status, payment_status FROM orders WHERE idempotency_key = ?")
      .get(input.idempotencyKey) as
      | { id: string; total_paise: number; status: string; payment_status: string }
      | undefined;
    if (existingOrder) {
      const existingTrade = db
        .prepare("SELECT * FROM trade_orders WHERE order_id = ?")
        .get(existingOrder.id) as Record<string, unknown> | undefined;
      return {
        orderId: existingOrder.id,
        accessToken: existingTrade ? String(existingTrade.access_token) : "",
        totalPaise: existingOrder.total_paise,
        dueNowPaise: existingTrade ? Number(existingTrade.due_now_paise) : existingOrder.total_paise,
        dueLaterPaise: existingTrade ? Number(existingTrade.due_later_paise) : 0,
        paymentMode: existingTrade ? String(existingTrade.payment_mode) : input.paymentMode,
        status: existingOrder.status,
        paymentStatus: existingOrder.payment_status,
        deduped: true,
      };
    }

    // 2. Load quote
    const quote = db
      .prepare("SELECT * FROM trade_quotes WHERE id = ?")
      .get(input.quoteId) as Record<string, unknown> | undefined;
    if (!quote) {
      throw new TradeCheckoutError("Quote not found.", 404, "quote_not_found");
    }
    if (String(quote.session_id) !== sessionId) {
      throw new TradeCheckoutError(
        "This quote belongs to a different session.",
        403,
        "quote_forbidden"
      );
    }
    if (String(quote.kind) !== "confirmed" || Number(quote.total_paise) <= 0) {
      throw new TradeCheckoutError(
        "Only confirmed quotes with a valid total can be ordered.",
        400,
        "invalid_request"
      );
    }
    if (quote.converted_order_id) {
      throw new TradeCheckoutError(
        "This quote has already been converted into an order.",
        409,
        "quote_already_used"
      );
    }
    if (new Date(String(quote.expires_at)).getTime() <= Date.now()) {
      throw new TradeCheckoutError(
        "This quote has expired. Please refresh your delivery quote.",
        409,
        "quote_expired"
      );
    }
    if (String(quote.payment_method) !== input.paymentMode) {
      throw new TradeCheckoutError(
        "Payment method changed. Please refresh your quote first.",
        409,
        "quote_stale"
      );
    }

    // 3. Revalidate lane active status
    if (quote.lane_id) {
      const lane = db
        .prepare("SELECT is_active FROM trade_lanes WHERE id = ?")
        .get(String(quote.lane_id)) as { is_active: number } | undefined;
      if (!lane || !lane.is_active) {
        throw new TradeCheckoutError(
          "This delivery lane is currently paused. Please re-quote or request an enquiry.",
          409,
          "lane_disabled"
        );
      }
    }

    // 4. Revalidate line items, prices & decrement stock atomically
    const lines = JSON.parse(String(quote.lines_json || "[]")) as QuoteLineSnapshot[];
    if (String(quote.quote_type) === "bulk") {
      for (const line of lines) {
        const variant = db
          .prepare(
            `
            SELECT v.id, v.price_paise, v.stock
            FROM variants v
            JOIN products p ON p.id = v.product_id
            JOIN trade_offers o ON o.product_id = p.id
            WHERE v.id = ? AND o.published = 1 AND ${enabledProductCondition("p")}
          `
          )
          .get(line.variantId) as
          | { id: number; price_paise: number; stock: number }
          | undefined;

        if (!variant) {
          throw new TradeCheckoutError(
            `${line.productName} is no longer available in the trade channel.`,
            409,
            "quote_stale"
          );
        }
        if (variant.price_paise !== line.unitPricePaise) {
          throw new TradeCheckoutError(
            `Price for ${line.productName} changed since your quote. Please refresh the quote.`,
            409,
            "quote_stale"
          );
        }
        const dec = db
          .prepare("UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?")
          .run(line.quantity, line.variantId, line.quantity);
        if (dec.changes === 0) {
          throw new TradeCheckoutError(
            `Insufficient stock for ${line.productName}.`,
            409,
            "insufficient_stock"
          );
        }
      }
    }

    const creditRedeemedKey =
      Number(quote.credit_paise) > 0 && quote.enquiry_draft
        ? String(quote.enquiry_draft)
        : null;
    if (creditRedeemedKey) {
      const priorRedemption = db
        .prepare("SELECT id FROM trade_orders WHERE credit_redeemed_key = ?")
        .get(creditRedeemedKey);
      if (priorRedemption) {
        throw new TradeCheckoutError(
          "Trial credit has already been redeemed on a prior order.",
          409,
          "quote_stale"
        );
      }
    }

    // 5. Create order + trade_orders
    const orderId = `TRD-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const accessToken = randomBytes(24).toString("hex");
    const handover = JSON.parse(String(quote.handover_json || '{"kind":"doorstep","locality":""}')) as Handover;
    const subtotalPaise = Number(quote.goods_paise);
    const shippingPaise = Number(quote.freight_paise);
    const totalPaise = Number(quote.total_paise);
    const dueNowPaise = Number(quote.due_now_paise);
    const dueLaterPaise = Number(quote.due_later_paise);

    const orderStatus = input.paymentMode === "cod" ? "confirmed_cod" : "pending_payment";
    const paymentStatus = input.paymentMode === "cod" ? "cod_pending" : "unpaid";
    const shippingMethod = `trade_${handover.kind}`;

    const fullAddress = `${input.shippingAddress} (PIN: ${quote.destination_pin})`;

    // Inspect orders columns to remain compatible with any schema migration state
    const orderCols = new Set(
      (db.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>).map(
        (c) => c.name
      )
    );

    if (orderCols.has("customer_phone") && orderCols.has("payment_status") && orderCols.has("shipping_method")) {
      db.prepare(`
        INSERT INTO orders (
          id, idempotency_key, customer_name, customer_email, customer_phone,
          shipping_address, subtotal_paise, shipping_paise, total_paise,
          status, payment_status, shipping_method, dispatch_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        orderId,
        input.idempotencyKey,
        input.customerName,
        input.customerEmail || "trade-buyer@teafloww.local",
        input.customerPhone,
        fullAddress,
        subtotalPaise,
        shippingPaise,
        totalPaise,
        orderStatus,
        paymentStatus,
        shippingMethod
      );
    } else {
      db.prepare(`
        INSERT INTO orders (
          id, idempotency_key, customer_name, customer_email,
          shipping_address, subtotal_paise, shipping_paise, total_paise, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        input.idempotencyKey,
        input.customerName,
        input.customerEmail || "trade-buyer@teafloww.local",
        fullAddress,
        subtotalPaise,
        shippingPaise,
        totalPaise,
        orderStatus
      );
    }

    if (String(quote.quote_type) === "bulk") {
      for (const line of lines) {
        db.prepare(
          "INSERT INTO order_items (order_id, variant_id, quantity, unit_price_paise) VALUES (?, ?, ?, ?)"
        ).run(orderId, line.variantId, line.quantity, line.unitPricePaise);
      }
    }

    db.prepare(`
      INSERT INTO trade_orders (
        id, order_id, quote_id, access_token, locale, destination_pin,
        payment_mode, handover_json, goods_paise, freight_paise,
        extra_tax_paise, other_fees_paise, credit_paise, total_paise,
        due_now_paise, due_later_paise, remittance_status, credit_redeemed_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      orderId,
      input.quoteId,
      accessToken,
      String(quote.locale),
      String(quote.destination_pin),
      input.paymentMode,
      JSON.stringify(handover),
      subtotalPaise,
      shippingPaise,
      Number(quote.extra_tax_paise),
      Number(quote.other_fees_paise),
      Number(quote.credit_paise),
      totalPaise,
      dueNowPaise,
      dueLaterPaise,
      dueLaterPaise > 0 ? "pending" : "none",
      creditRedeemedKey
    );

    db.prepare("UPDATE trade_quotes SET converted_order_id = ? WHERE id = ?").run(
      orderId,
      input.quoteId
    );

    try {
      db.prepare(`
        INSERT INTO trade_funnel_events (
          id, session_id, event_name, locale, transaction_id, quote_id, order_id, value_paise, metadata_json
        ) VALUES (?, ?, 'checkout_started', ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        sessionId,
        String(quote.locale),
        orderId,
        input.quoteId,
        orderId,
        totalPaise,
        JSON.stringify({ paymentMode: input.paymentMode, handoverKind: handover.kind })
      );
    } catch {}

    return {
      orderId,
      accessToken,
      totalPaise,
      dueNowPaise,
      dueLaterPaise,
      paymentMode: input.paymentMode,
      status: orderStatus,
      paymentStatus,
      deduped: false,
    };
  })();

  if (!result.deduped && result.paymentMode === "prepaid" && result.dueNowPaise === result.totalPaise) {
    try {
      const hasPaymentsTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='order_payments'")
        .get();
      if (hasPaymentsTable) {
        recordPaymentIntent(
          result.orderId,
          result.dueNowPaise,
          `trd_pay_${input.idempotencyKey}`,
          "demo"
        );
        result.paymentStatus = "payment_pending";
      }
    } catch {
      // Non-fatal if payment_events/order_payments is absent in minimal test DBs
    }
  }

  return result;
}

export function getAuthorizedTradeOrder(orderId: string, accessToken: string) {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT t.*, o.customer_name, o.shipping_address, o.status AS order_status,
             o.payment_status, o.dispatch_status, o.created_at AS order_created_at,
             q.lines_json, q.net_grams, q.billed_grams, q.eta_label, q.quote_type
      FROM trade_orders t
      JOIN orders o ON o.id = t.order_id
      JOIN trade_quotes q ON q.id = t.quote_id
      WHERE t.order_id = ?
    `
    )
    .get(orderId) as Record<string, unknown> | undefined;

  if (!row) return null;
  if (!accessToken || String(row.access_token) !== accessToken) {
    throw new TradeCheckoutError("Unauthorized order link.", 403, "quote_forbidden");
  }

  return {
    orderId: String(row.order_id),
    quoteId: String(row.quote_id),
    quoteType: String(row.quote_type) as "bulk" | "trial",
    locale: String(row.locale),
    destinationPin: String(row.destination_pin),
    customerName: String(row.customer_name),
    shippingAddress: String(row.shipping_address),
    paymentMode: String(row.payment_mode),
    orderStatus: String(row.order_status),
    paymentStatus: String(row.payment_status || "unpaid"),
    dispatchStatus: String(row.dispatch_status || "pending"),
    handover: JSON.parse(String(row.handover_json)) as Handover,
    lines: JSON.parse(String(row.lines_json || "[]")) as QuoteLineSnapshot[],
    netGrams: Number(row.net_grams),
    billedGrams: Number(row.billed_grams),
    goodsPaise: Number(row.goods_paise),
    freightPaise: Number(row.freight_paise),
    extraTaxPaise: Number(row.extra_tax_paise),
    otherFeesPaise: Number(row.other_fees_paise),
    creditPaise: Number(row.credit_paise),
    totalPaise: Number(row.total_paise),
    dueNowPaise: Number(row.due_now_paise),
    dueLaterPaise: Number(row.due_later_paise),
    remittanceStatus: String(row.remittance_status),
    etaLabel: row.eta_label ? String(row.eta_label) : null,
    createdAt: String(row.order_created_at),
  };
}

export function saveReorderReminder(rawInput: unknown) {
  const input = ReorderReminderRequestSchema.parse(rawInput);
  const db = getDb();
  const order = db
    .prepare("SELECT access_token FROM trade_orders WHERE order_id = ?")
    .get(input.orderId) as { access_token: string } | undefined;
  if (!order || order.access_token !== input.accessToken) {
    throw new TradeCheckoutError("Unauthorized order.", 403, "quote_forbidden");
  }

  const nextReminderAt = input.optedIn
    ? new Date(Date.now() + input.cadenceDays * 86400 * 1000).toISOString()
    : null;
  const existing = db
    .prepare("SELECT id FROM trade_reorder_reminders WHERE order_id = ?")
    .get(input.orderId) as { id: string } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE trade_reorder_reminders
      SET contact_phone = ?, locale = ?, cadence_days = ?, opted_in = ?,
          next_reminder_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      input.contactPhone,
      input.locale,
      input.cadenceDays,
      input.optedIn ? 1 : 0,
      nextReminderAt,
      existing.id
    );
    return db
      .prepare("SELECT * FROM trade_reorder_reminders WHERE id = ?")
      .get(existing.id);
  }

  const id = `REM-${randomUUID().slice(0, 10).toUpperCase()}`;
  db.prepare(`
    INSERT INTO trade_reorder_reminders (
      id, order_id, contact_phone, locale, cadence_days, opted_in, next_reminder_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.orderId,
    input.contactPhone,
    input.locale,
    input.cadenceDays,
    input.optedIn ? 1 : 0,
    nextReminderAt
  );
  return db.prepare("SELECT * FROM trade_reorder_reminders WHERE id = ?").get(id);
}
