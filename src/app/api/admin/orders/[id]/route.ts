import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrderFull } from "@/lib/orders";
import { getDb } from "@/lib/db";
import { guard, notFound, invalid, conflict } from "@/lib/adminHttp";

export const runtime = "nodejs";

const updateOrderSchema = z.object({
  admin_notes: z.string().trim().max(2000).optional(),
  shipping_address: z.string().trim().min(5).max(500).optional(),
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

  // Fetch audit event timeline from payment_events
  const db = getDb();
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

  const order = {
    ...baseOrder,
    events,
  };

  return NextResponse.json({ order, events });
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
  const currentOrder = current as { admin_notes?: string; shipping_address?: string };
  const nextNotes = parsed.data.admin_notes !== undefined ? parsed.data.admin_notes : currentOrder.admin_notes ?? "";
  const nextAddress = parsed.data.shipping_address !== undefined ? parsed.data.shipping_address : current.shipping_address;

  try {
    db.prepare("UPDATE orders SET admin_notes = ?, shipping_address = ? WHERE id = ?").run(
      nextNotes,
      nextAddress,
      decodedId
    );
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
