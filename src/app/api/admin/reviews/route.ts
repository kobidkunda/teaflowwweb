import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, notFound } from "@/lib/adminHttp";
import { listAdminReviews, moderateProductReview, type ReviewStatus } from "@/lib/reviews";

export const runtime = "nodejs";

const moderateSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["pending", "approved", "rejected"]),
});

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status") || "all";
  const statusFilter: ReviewStatus | "all" =
    rawStatus === "pending" || rawStatus === "approved" || rawStatus === "rejected"
      ? rawStatus
      : "all";

  return NextResponse.json({ reviews: listAdminReviews(statusFilter) });
}

export async function PATCH(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = moderateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());

  const updated = moderateProductReview(parsed.data.id, parsed.data.status);
  if (!updated) return notFound("Review not found.");

  return NextResponse.json({ ok: true, review: updated });
}
