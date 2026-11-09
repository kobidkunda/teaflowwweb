import { NextResponse } from "next/server";
import { updateInventoryStock } from "@/lib/inventory";
import { inventoryUpdateSchema, normalizeInventoryInput } from "@/lib/validation";
import { guard, invalid, notFound, conflict, keyOf } from "@/lib/adminHttp";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sets inventory to an exact quantity (not a delta).
 * Body: { product?: id|slug, sku?: string, variantId?: number, quantity|stock|inventory: int>=0, idempotencyKey? }
 * - sku/variantId updates one variant; product updates all variants
 *   (creating one default 100g variant when the product has none).
 */
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const rawBody: unknown = await request.json().catch(() => null);
  const parsed = inventoryUpdateSchema.safeParse(normalizeInventoryInput(rawBody));
  if (!parsed.success) return invalid(parsed.error.flatten());

  try {
    const { body, deduped } = updateInventoryStock({
      ...parsed.data,
      idempotencyKey: keyOf(request, parsed.data),
    });
    return NextResponse.json({ ...body, deduped }, { status: deduped ? 200 : 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unable to update inventory.";
    if (/not found/i.test(msg)) return notFound(msg.slice(0, 160));
    if (/does not belong/i.test(msg)) return conflict(msg.slice(0, 160));
    logger.error("Admin inventory POST error: " + msg);
    return conflict(msg);
  }
}
