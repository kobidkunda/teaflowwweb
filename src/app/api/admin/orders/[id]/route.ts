import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrderFull } from "@/lib/orders";
import { getDb } from "@/lib/db";
import { guard, notFound, invalid, conflict } from "@/lib/adminHttp";

export const runtime = "nodejs";

const updateOrderSchema = z.object({
  customer_name: z.string().trim().min(1).max(120).optional(),
  customer_email: z.string().trim().email().optional(),
  customer_phone: z.string().trim().max(30).optional(),
  shipping_address: z.string().trim().min(5).max(500).optional(),
  admin_notes: z.string().trim().max(2000).optional(),
  shipping_carrier: z.string().trim().max(80).optional(),
  tracking_number: z.string().trim().max(100).optional(),
  tracking_url: z.string().trim().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const baseOrder = getOrderFull(decodedId);
  if (!baseOrder) {
    return notFound("Order not found.");
  }

  const db = getDb();

  // Fetch audit event timeline from payment_events
  let events: Array<{
    id: number;
    order_id: string;
    from_status: string;
    to_status: string;
    actor: string;
    created_at: string;
  }> = [];
  try {
    events = db
      .prepare(
        "SELECT id, order_id, from_status, to_status, actor, created_at FROM payment_events WHERE order_id = ? ORDER BY id ASC"
      )
      .all(decodedId) as typeof events;
  } catch {
    events = [];
  }

  // Fetch transaction records from order_payments
  let transactions: Array<{
    id: string;
    gateway: string;
    gateway_payment_id?: string | null;
    amount_paise: number;
    status: string;
    created_at: string;
  }> = [];
  try {
    transactions = db
      .prepare(
        "SELECT id, gateway, gateway_payment_id, amount_paise, status, created_at FROM order_payments WHERE order_id = ? ORDER BY created_at DESC"
      )
      .all(decodedId) as typeof transactions;
  } catch {
    transactions = [];
  }

  // Fetch shipment / tracking details from commerce_shipments
  let shipment: Record<string, unknown> | null = null;
  try {
    const sRow = db
      .prepare("SELECT order_id, document, status, updated_ms FROM commerce_shipments WHERE order_id = ?")
      .get(decodedId) as { order_id: string; document: string; status: string; updated_ms: number } | undefined;
    if (sRow && sRow.document && sRow.document !== "{}") {
      const parsedDoc = JSON.parse(sRow.document);
      shipment = {
        orderId: sRow.order_id,
        status: sRow.status,
        updatedAt: sRow.updated_ms,
        carrierName: parsedDoc.carrierName || parsedDoc.awb?.courier_name || parsedDoc.courier_name,
        trackingNumber: parsedDoc.trackingNumber || parsedDoc.awb?.awb_code || parsedDoc.awb_code,
        trackingUrl: parsedDoc.trackingUrl || parsedDoc.publicTracking,
        labelUrl: parsedDoc.labelUrl || parsedDoc.label?.label_url,
        ...parsedDoc,
      };
    }
  } catch {
    shipment = null;
  }

  const order = {
    ...baseOrder,
    events,
    transactions,
    shipment,
  };

  return NextResponse.json({ order, events, transactions, shipment });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  const current = getOrderFull(decodedId);
  if (!current) {
    return notFound("Order not found.");
  }

  const db = getDb();
  const currentOrder = current as {
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string | null;
    admin_notes?: string;
    shipping_address?: string;
  };

  const nextName = parsed.data.customer_name !== undefined ? parsed.data.customer_name : current.customer_name;
  const nextEmail = parsed.data.customer_email !== undefined ? parsed.data.customer_email : current.customer_email;
  const nextPhone = parsed.data.customer_phone !== undefined ? parsed.data.customer_phone : current.customer_phone;
  const nextNotes = parsed.data.admin_notes !== undefined ? parsed.data.admin_notes : currentOrder.admin_notes ?? "";
  const nextAddress = parsed.data.shipping_address !== undefined ? parsed.data.shipping_address : current.shipping_address;

  try {
    // 1. Update orders table if present
    db.prepare(`
      UPDATE orders 
      SET customer_name = ?, customer_email = ?, customer_phone = ?, admin_notes = ?, shipping_address = ? 
      WHERE id = ?
    `).run(nextName, nextEmail, nextPhone, nextNotes, nextAddress, decodedId);

    // 2. Update commerce_orders document if present
    const cOrder = db
      .prepare("SELECT id, document FROM commerce_orders WHERE id = ?")
      .get(decodedId) as { id: string; document: string } | undefined;
    if (cOrder && cOrder.document) {
      try {
        const doc = JSON.parse(cOrder.document);
        if (doc.input && doc.input.address) {
          if (parsed.data.customer_name) doc.input.address.name = parsed.data.customer_name;
          if (parsed.data.customer_email) doc.input.address.email = parsed.data.customer_email;
          if (parsed.data.customer_phone) doc.input.address.phone = parsed.data.customer_phone;
          if (parsed.data.shipping_address) doc.input.address.line1 = parsed.data.shipping_address;
        }
        db.prepare("UPDATE commerce_orders SET document = ? WHERE id = ?").run(JSON.stringify(doc), decodedId);
      } catch {}
    }

    // 3. Update carrier / tracking in commerce_shipments if provided
    if (parsed.data.shipping_carrier || parsed.data.tracking_number || parsed.data.tracking_url) {
      try {
        // Ensure parent commerce_quotes and commerce_orders rows exist so foreign key is satisfied
        const cCheck = db.prepare("SELECT id FROM commerce_orders WHERE id = ?").get(decodedId);
        if (!cCheck) {
          const quoteId = `quote_${decodedId}`;
          db.prepare(
            "INSERT OR IGNORE INTO commerce_quotes (id, owner, document, expires_ms) VALUES (?, 'admin', '{}', ?)"
          ).run(quoteId, Date.now() + 864000000);
          db.prepare(
            "INSERT OR IGNORE INTO commerce_orders (id, owner, idempotency_key, quote_id, document, payment_status, fulfillment_status, reserved_until, created_ms) VALUES (?, 'admin', ?, ?, '{}', ?, ?, ?, ?)"
          ).run(
            decodedId,
            `idem_${decodedId}`,
            quoteId,
            current.payment_status || "unpaid",
            current.dispatch_status || "unfulfilled",
            Date.now() + 864000000,
            Date.now()
          );
        }

        const sRow = db
          .prepare("SELECT document FROM commerce_shipments WHERE order_id = ?")
          .get(decodedId) as { document: string } | undefined;
        const curDoc = sRow?.document && sRow.document !== "{}" ? JSON.parse(sRow.document) : {};
        const updatedShipDoc = {
          ...curDoc,
          carrierName: parsed.data.shipping_carrier || curDoc.carrierName,
          trackingNumber: parsed.data.tracking_number || curDoc.trackingNumber,
          trackingUrl: parsed.data.tracking_url || curDoc.trackingUrl,
          awb: {
            ...(curDoc.awb || {}),
            awb_code: parsed.data.tracking_number || curDoc.awb?.awb_code,
            courier_name: parsed.data.shipping_carrier || curDoc.awb?.courier_name,
          },
        };
        db.prepare(`
          INSERT INTO commerce_shipments (order_id, document, status, updated_ms)
          VALUES (?, ?, 'shipped', ?)
          ON CONFLICT(order_id) DO UPDATE SET document = excluded.document, updated_ms = excluded.updated_ms
        `).run(decodedId, JSON.stringify(updatedShipDoc), Date.now());
      } catch {
        // Ignored or handled by caller
      }
    }

    // 4. Log modification audit event
    try {
      db.prepare(`
        INSERT INTO payment_events (order_id, from_status, to_status, actor)
        VALUES (?, 'details', 'order_modified', 'admin')
      `).run(decodedId);
    } catch {}

    const updated = getOrderFull(decodedId);
    return NextResponse.json({ order: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unable to update order.";
    return conflict(msg);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}
