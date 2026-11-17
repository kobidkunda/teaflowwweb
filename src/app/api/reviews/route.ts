import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitResponse } from "@/lib/rateLimit";
import {
  getApprovedReviewSummary,
  listApprovedReviews,
  submitReviewSchema,
  submitVerifiedProductReview,
} from "@/lib/reviews";

export const runtime = "nodejs";

const querySchema = z.object({
  entityType: z.enum(["product", "trial", "packaging"]),
  entityId: z.string().trim().min(1).max(100),
});

export function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    entityType: url.searchParams.get("entityType"),
    entityId: url.searchParams.get("entityId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid entity query parameters." }, { status: 400 });
  }

  const summary = getApprovedReviewSummary(parsed.data.entityType, parsed.data.entityId);
  const reviews = listApprovedReviews(parsed.data.entityType, parsed.data.entityId, 30).map((r) => ({
    id: r.id,
    reviewer_name: r.reviewer_name,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verified_purchase: r.verified_purchase,
    created_at: r.created_at,
  }));

  return NextResponse.json({ summary, reviews });
}

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "product_review_submit", 10);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = submitReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please check the highlighted review fields.",
        issues: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const created = submitVerifiedProductReview(parsed.data);
    return NextResponse.json(
      {
        ok: true,
        review: {
          id: created.id,
          status: created.status,
          verified_purchase: created.verified_purchase,
        },
        message: "Thank you. Your verified review has been submitted for moderation.",
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to submit review." },
      { status: 400 }
    );
  }
}
