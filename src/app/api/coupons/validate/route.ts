import { NextResponse } from "next/server";
import { z } from "zod";
import { validateCouponServer } from "@/lib/storefront";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";

export const runtime = "nodejs";

const bodySchema = z.object({
  code: z.string().trim().min(1).max(24),
  subtotalPaise: z.number().int().min(0).max(100_000_000),
});

/** Server-priced coupon preview. Generic errors only; no coupon internals leak. */
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "coupon", RATE_LIMITS.publicSensitive);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { valid: false, reason: "Please provide a code and subtotal." },
      { status: 400 }
    );
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { valid: false, reason: "Please provide a code and subtotal." },
      { status: 400 }
    );
  const result = validateCouponServer(
    parsed.data.code,
    parsed.data.subtotalPaise
  );
  if (!result.valid)
    return NextResponse.json(result, { status: 200 });
  return NextResponse.json(result, { status: 200 });
}
