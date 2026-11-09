import { NextResponse } from "next/server";
import { z } from "zod";
import { getCoupon, upsertCoupon, deleteCoupon } from "@/lib/coupons";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { code } = await params;
  const coupon = getCoupon(decodeURIComponent(code));
  if (!coupon) return notFound("Coupon not found.");

  const db = getDb();
  const stats = db
    .prepare(
      "SELECT COUNT(*) AS order_count, COALESCE(SUM(total_paise), 0) AS total_revenue_paise FROM orders WHERE coupon_code = ?"
    )
    .get(coupon.code) as { order_count: number; total_revenue_paise: number } | undefined;

  return NextResponse.json({
    coupon,
    usage: {
      used_count: coupon.used_count,
      order_count: stats?.order_count ?? 0,
      total_revenue_paise: stats?.total_revenue_paise ?? 0,
    },
  });
}

const couponUpdateSchema = z.object({
  kind: z.enum(["percent", "flat"]).optional(),
  value: z.number().int().positive().optional(),
  min_subtotal_paise: z.number().int().min(0).optional(),
  max_uses: z.number().int().positive().nullable().optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  is_active: z.union([z.literal(0), z.literal(1)]).optional(),
});

async function handleUpdate(request: Request, paramsPromise: Promise<{ code: string }>) {
  const denied = guard(request);
  if (denied) return denied;
  const { code } = await paramsPromise;
  const current = getCoupon(decodeURIComponent(code));
  if (!current) return notFound("Coupon not found.");
  const body: unknown = await request.json().catch(() => null);
  const parsed = couponUpdateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());

  const effectiveKind = parsed.data.kind ?? (current.kind as "percent" | "flat");
  const effectiveValue = parsed.data.value ?? current.value;
  if (effectiveKind === "percent" && (effectiveValue < 1 || effectiveValue > 50)) {
    return invalid({ value: ["Percent coupons must have a value between 1 and 50."] });
  }

  try {
    const coupon = upsertCoupon({
      code: current.code,
      kind: effectiveKind,
      value: effectiveValue,
      min_subtotal_paise: parsed.data.min_subtotal_paise ?? current.min_subtotal_paise,
      max_uses: parsed.data.max_uses !== undefined ? parsed.data.max_uses : current.max_uses,
      starts_at: parsed.data.starts_at !== undefined ? parsed.data.starts_at : current.starts_at,
      ends_at: parsed.data.ends_at !== undefined ? parsed.data.ends_at : current.ends_at,
      is_active: (parsed.data.is_active ?? current.is_active) as 1 | 0,
    });
    return NextResponse.json({ coupon });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to update the coupon.");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  return handleUpdate(request, params);
}

export async function PUT(request: Request, { params }: { params: Promise<{ code: string }> }) {
  return handleUpdate(request, params);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { code } = await params;
  try {
    return deleteCoupon(decodeURIComponent(code))
      ? new NextResponse(null, { status: 204 })
      : notFound("Coupon not found.");
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to delete the coupon.");
  }
}
