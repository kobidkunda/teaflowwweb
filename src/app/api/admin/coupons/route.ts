import { NextResponse } from "next/server";
import { listCoupons, upsertCoupon } from "@/lib/coupons";
import { couponSchema } from "@/lib/validation";
import { guard, invalid, conflict, keyOf } from "@/lib/adminHttp";
export const runtime = "nodejs";
export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  return NextResponse.json({ coupons: listCoupons() });
}
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const body: unknown = await request.json().catch(() => null);
  const parsed = couponSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  try {
    const coupon = upsertCoupon({ ...parsed.data, idempotencyKey: keyOf(request, parsed.data) });
    return NextResponse.json({ coupon }, { status: 201 });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to save the coupon.");
  }
}
