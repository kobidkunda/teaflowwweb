import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicOrder } from "@/lib/storefront";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";

export const runtime = "nodejs";

// ≥8 chars: the printed confirmation reference is the 8-char prefix, and
// shorter prefixes are enumerable (see getPublicOrder). Exact UUIDs pass.
const querySchema = z.object({ id: z.string().trim().min(8).max(64) });

/**
 * Redacted public order lookup. Never returns name, email or address.
 * Accepts ?id=<uuid> or ?id=<8-char reference shown on the confirmation>.
 * Misses and short inputs share one generic 404/400 shape (minimal oracle).
 */
export function GET(request: Request) {
  const limited = rateLimitResponse(request, "lookup", RATE_LIMITS.lookup);
  if (limited) return limited;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ id: url.searchParams.get("id") ?? "" });
  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter the order reference from your confirmation." },
      { status: 400 }
    );
  const order = getPublicOrder(parsed.data.id);
  if (!order)
    return NextResponse.json(
      { error: "We could not find that order. Check the reference and retry." },
      { status: 404 }
    );
  return NextResponse.json({ order });
}
