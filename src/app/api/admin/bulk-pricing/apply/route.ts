import { NextResponse } from "next/server";
import { guard, invalid, conflict, keyOf } from "@/lib/adminHttp";
import { bulkPricingApplySchema, applyBulkPricing } from "@/lib/bulkPricing";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pushes previewed pricing rows live in one all-or-nothing transaction.
 * Body: { rows: [{ variant_id, price_paise, compare_at_price_paise|null, stock }], idempotencyKey? }
 * Re-validates everything server-side; the preview is never trusted.
 */
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const rawBody: unknown = await request.json().catch(() => null);
  const parsed = bulkPricingApplySchema.safeParse(rawBody);
  if (!parsed.success) return invalid(parsed.error.flatten());

  try {
    const { body, deduped } = applyBulkPricing({
      ...parsed.data,
      idempotencyKey: keyOf(request, parsed.data),
    });
    return NextResponse.json({ ...body, deduped }, { status: deduped ? 200 : 201 });
  } catch (e) {
    logger.error("Admin bulk-pricing apply error: " + (e instanceof Error ? e.message : String(e)));
    return conflict(e instanceof Error ? e.message : "Unable to apply the pricing update.");
  }
}
