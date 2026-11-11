import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
import { confirmBankTransferPayment } from "@/lib/international/orders";
import { CommerceError } from "@/lib/international/models";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  utrReference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());

  try {
    const updated = confirmBankTransferPayment(
      decodedId,
      "admin",
      parsed.data.utrReference,
      parsed.data.notes
    );
    return NextResponse.json({ ok: true, order: updated });
  } catch (e) {
    if (e instanceof CommerceError) {
      if (/not found/i.test(e.message)) {
        // Fallback check if it's in the legacy orders table
        const db = getDb();
        const legacy = db.prepare("SELECT * FROM orders WHERE id=?").get(decodedId) as { id: string; payment_status: string } | undefined;
        if (legacy) {
          db.prepare("UPDATE orders SET payment_status='paid', status='paid' WHERE id=?").run(decodedId);
          db.prepare("INSERT INTO payment_events (order_id, from_status, to_status, actor) VALUES (?, ?, ?, ?)").run(
            decodedId,
            legacy.payment_status || "unpaid",
            "paid",
            "admin"
          );
          return NextResponse.json({ ok: true, legacy: true });
        }
        return notFound("Order not found.");
      }
      return conflict(e.message);
    }
    return conflict(e instanceof Error ? e.message : "Unable to confirm bank transfer payment.");
  }
}
