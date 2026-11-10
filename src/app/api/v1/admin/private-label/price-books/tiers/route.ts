/**
 * Admin Private Label Studio — Price Book Tiers API
 *
 * POST /api/v1/admin/private-label/price-books/tiers — Add or update tiers for a price book
 */

import { NextResponse } from "next/server";
import { guard } from "@/lib/adminHttp";
import { getDb } from "@/lib/db";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawData =
    body && typeof body === "object" && "data" in body && typeof (body as Record<string, unknown>).data === "object"
      ? ((body as Record<string, unknown>).data as Record<string, unknown>)
      : (body as Record<string, unknown>);

  const priceBookId = (rawData.price_book_id || rawData.priceBookId) as string | undefined;
  if (!priceBookId) {
    return NextResponse.json({ error: "price_book_id is required" }, { status: 400 });
  }

  // Check single tier input
  const unitPricePaise = rawData.unit_price_paise ?? rawData.unitPricePaise;
  const minQuantity = rawData.min_quantity ?? rawData.minQuantity ?? rawData.min_qty;

  if (unitPricePaise !== undefined && Number(unitPricePaise) < 0) {
    return NextResponse.json({ error: "unit_price_paise cannot be negative" }, { status: 400 });
  }
  if (minQuantity !== undefined && Number(minQuantity) < 0) {
    return NextResponse.json({ error: "min_quantity cannot be negative" }, { status: 400 });
  }

  // Check array of tiers
  const tiers = rawData.tiers as Array<{ min_qty?: number; max_qty?: number; unit_price_paise?: number }> | undefined;
  const warnings: string[] = [];

  if (Array.isArray(tiers)) {
    // Validate individual tiers
    for (const t of tiers) {
      if (t.unit_price_paise !== undefined && Number(t.unit_price_paise) < 0) {
        return NextResponse.json({ error: "Tier unit_price_paise cannot be negative" }, { status: 400 });
      }
      if (t.min_qty !== undefined && Number(t.min_qty) < 0) {
        return NextResponse.json({ error: "Tier min_qty cannot be negative" }, { status: 400 });
      }
      if (t.max_qty !== undefined && t.min_qty !== undefined && Number(t.max_qty) < Number(t.min_qty)) {
        return NextResponse.json({ error: "Tier max_qty cannot be less than min_qty" }, { status: 400 });
      }
    }

    // Sort by min_qty to check for overlaps
    const sortedTiers = [...tiers].sort((a, b) => (Number(a.min_qty || 0)) - (Number(b.min_qty || 0)));
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      const current = sortedTiers[i];
      const next = sortedTiers[i + 1];
      const currentMax = current.max_qty !== undefined ? Number(current.max_qty) : Infinity;
      const nextMin = Number(next.min_qty || 0);

      if (nextMin <= currentMax) {
        return NextResponse.json(
          { error: `Overlapping quantity intervals detected: [${current.min_qty}, ${current.max_qty}] and [${next.min_qty}, ${next.max_qty}]` },
          { status: 422 }
        );
      }
    }

    // Check for inverted/descending price breaks (higher quantity with higher unit price) -> warning
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      const current = sortedTiers[i];
      const next = sortedTiers[i + 1];
      if (
        current.unit_price_paise !== undefined &&
        next.unit_price_paise !== undefined &&
        Number(next.unit_price_paise) > Number(current.unit_price_paise)
      ) {
        warnings.push(`Higher quantity tier (${next.min_qty}+) has higher unit price than previous tier (${current.min_qty}+).`);
      }
    }
  }

  const db = getDb();
  // Verify price book exists
  const book = db.prepare("SELECT id FROM pl_price_books WHERE id = ?").get(priceBookId);
  if (!book) {
    return NextResponse.json({ error: `Price book ${priceBookId} not found` }, { status: 404 });
  }

  try {
    db.transaction(() => {
      if (unitPricePaise !== undefined) {
        const id = `tier_${randomUUID()}`;
        db.prepare(
          `INSERT INTO pl_price_book_tiers (id, price_book_id, item_type, item_id, min_qty, max_qty, unit_price_paise)
           VALUES (?, ?, 'packaging', 'default', ?, ?, ?)`
        ).run(id, priceBookId, Math.max(0, Number(minQuantity) || 0), null, Number(unitPricePaise));
      }

      if (Array.isArray(tiers)) {
        for (const t of tiers) {
          const id = `tier_${randomUUID()}`;
          db.prepare(
            `INSERT INTO pl_price_book_tiers (id, price_book_id, item_type, item_id, min_qty, max_qty, unit_price_paise)
             VALUES (?, ?, 'packaging', 'default', ?, ?, ?)`
          ).run(id, priceBookId, Number(t.min_qty || 0), t.max_qty !== undefined ? Number(t.max_qty) : null, Number(t.unit_price_paise || 0));
        }
      }
    })();

    return NextResponse.json({ success: true, warnings }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to insert tiers";
    if (/constraint|check/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
