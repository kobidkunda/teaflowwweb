import { z } from "zod";
import { getDb } from "@/lib/db";

export type ReviewEntityType = "product" | "trial" | "packaging";
export type ReviewStatus = "pending" | "approved" | "rejected";

export interface ProductReview {
  id: number;
  entity_type: ReviewEntityType;
  entity_id: string;
  order_id: string | null;
  commerce_order_id: string | null;
  customer_id: number | null;
  reviewer_name: string;
  rating: number;
  title: string;
  body: string;
  verified_purchase: boolean;
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
}

export interface ReviewSummary {
  ratingValue: number;
  reviewCount: number;
}

export const submitReviewSchema = z.object({
  entity_type: z.enum(["product", "trial", "packaging"]),
  entity_id: z.string().trim().min(1).max(100),
  order_reference: z.string().trim().min(3, "Order ID is required for verified reviews").max(120),
  reviewer_email: z.string().trim().email("Valid purchase email is required").max(160),
  reviewer_name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(2, "Review headline is required").max(140),
  body: z.string().trim().min(10, "Please share at least 10 characters about your cup").max(2000),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

function hasReviewsTable(): boolean {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_reviews'")
      .get();
    return Boolean(row);
  } catch {
    return false;
  }
}

function mapReviewRow(r: Record<string, unknown>): ProductReview {
  return {
    id: Number(r.id),
    entity_type: String(r.entity_type) as ReviewEntityType,
    entity_id: String(r.entity_id),
    order_id: r.order_id ? String(r.order_id) : null,
    commerce_order_id: r.commerce_order_id ? String(r.commerce_order_id) : null,
    customer_id: r.customer_id !== null && r.customer_id !== undefined ? Number(r.customer_id) : null,
    reviewer_name: String(r.reviewer_name || "Verified Buyer"),
    rating: Number(r.rating),
    title: String(r.title || ""),
    body: String(r.body || ""),
    verified_purchase: Number(r.verified_purchase) === 1,
    status: String(r.status) as ReviewStatus,
    created_at: String(r.created_at || ""),
    updated_at: String(r.updated_at || ""),
  };
}

/**
 * Returns aggregate rating and count ONLY from real approved reviews.
 * Returns null when zero approved reviews exist (never fabricates ratings).
 */
export function getApprovedReviewSummary(
  entityType: ReviewEntityType,
  entityId: string | number
): ReviewSummary | null {
  if (!hasReviewsTable()) return null;
  try {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT COUNT(*) AS review_count, AVG(rating) AS avg_rating
         FROM product_reviews
         WHERE entity_type = ? AND entity_id = ? AND status = 'approved'`
      )
      .get(entityType, String(entityId)) as
      | { review_count: number | string; avg_rating: number | string | null }
      | undefined;

    const count = Number(row?.review_count || 0);
    const avg = Number(row?.avg_rating || 0);
    if (count <= 0 || !Number.isFinite(avg) || avg <= 0) {
      return null;
    }
    return {
      ratingValue: Math.round(avg * 10) / 10,
      reviewCount: count,
    };
  } catch {
    return null;
  }
}

/**
 * Batch-fetches approved review summaries for feeds & sitemaps.
 */
export function getBulkApprovedReviewSummaries(
  entityType: ReviewEntityType
): Map<string, ReviewSummary> {
  const result = new Map<string, ReviewSummary>();
  if (!hasReviewsTable()) return result;
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT entity_id, COUNT(*) AS review_count, AVG(rating) AS avg_rating
         FROM product_reviews
         WHERE entity_type = ? AND status = 'approved'
         GROUP BY entity_id`
      )
      .all(entityType) as Array<{
      entity_id: string;
      review_count: number | string;
      avg_rating: number | string | null;
    }>;

    for (const r of rows) {
      const count = Number(r.review_count || 0);
      const avg = Number(r.avg_rating || 0);
      if (count > 0 && Number.isFinite(avg) && avg > 0) {
        result.set(String(r.entity_id), {
          ratingValue: Math.round(avg * 10) / 10,
          reviewCount: count,
        });
      }
    }
  } catch {
    // Graceful fallback
  }
  return result;
}

/**
 * Lists approved public reviews (never exposes email or customer PII).
 */
export function listApprovedReviews(
  entityType: ReviewEntityType,
  entityId: string | number,
  limit = 20
): ProductReview[] {
  if (!hasReviewsTable()) return [];
  try {
    const db = getDb();
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const rows = db
      .prepare(
        `SELECT id, entity_type, entity_id, order_id, commerce_order_id, customer_id,
                reviewer_name, rating, title, body, verified_purchase, status, created_at, updated_at
         FROM product_reviews
         WHERE entity_type = ? AND entity_id = ? AND status = 'approved'
         ORDER BY created_at DESC, id DESC
         LIMIT ?`
      )
      .all(entityType, String(entityId), safeLimit) as Record<string, unknown>[];
    return rows.map(mapReviewRow);
  } catch {
    return [];
  }
}

/**
 * Verifies that an order reference and email correspond to an actual purchase
 * of the target product/trial in either `commerce_orders` or legacy `orders`.
 */
function verifyPurchaseOwnership(
  entityType: ReviewEntityType,
  entityId: string,
  orderRef: string,
  email: string
): {
  verified: boolean;
  orderId: string | null;
  commerceOrderId: string | null;
} {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOrder = orderRef.trim();

  // 1. Check live international/local commerce_orders
  try {
    const co = db
      .prepare(
        `SELECT id, payment_status, document
         FROM commerce_orders
         WHERE id = ? AND payment_status NOT IN ('failed', 'cancelled', 'abandoned')
         LIMIT 1`
      )
      .get(normalizedOrder) as
      | { id: string; payment_status: string; document: string }
      | undefined;

    if (co?.document) {
      const doc = JSON.parse(co.document) as {
        input?: { address?: { email?: string } };
        lines?: Array<{ productId?: number; trialId?: string }>;
      };
      const docEmail = (doc.input?.address?.email || "").trim().toLowerCase();
      if (docEmail && docEmail === normalizedEmail) {
        const lines = Array.isArray(doc.lines) ? doc.lines : [];
        const matched =
          entityType === "product"
            ? lines.some((l) => String(l.productId || "") === entityId)
            : entityType === "trial"
            ? lines.some((l) => String(l.trialId || "") === entityId)
            : false;
        if (matched) {
          return { verified: true, orderId: null, commerceOrderId: co.id };
        }
      }
    }
  } catch {
    // Continue to legacy orders check
  }

  // 2. Check legacy orders + order_items
  if (entityType === "product") {
    try {
      const legacy = db
        .prepare(
          `SELECT o.id
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           JOIN variants v ON v.id = oi.variant_id
           WHERE o.id = ?
             AND LOWER(TRIM(o.customer_email)) = ?
             AND v.product_id = ?
             AND o.status NOT IN ('cancelled', 'failed')
           LIMIT 1`
        )
        .get(normalizedOrder, normalizedEmail, Number(entityId)) as { id: string } | undefined;

      if (legacy?.id) {
        return { verified: true, orderId: legacy.id, commerceOrderId: null };
      }
    } catch {
      // Fall through
    }
  }

  return { verified: false, orderId: null, commerceOrderId: null };
}

/**
 * Submits a customer product review. Requires verified order ownership matching
 * the target item and enters the moderation queue as `pending` until approved.
 */
export function submitVerifiedProductReview(rawInput: SubmitReviewInput): ProductReview {
  if (!hasReviewsTable()) {
    throw new Error("Product reviews storage is not initialized. Run database migrations first.");
  }
  const input = submitReviewSchema.parse(rawInput);
  const verification = verifyPurchaseOwnership(
    input.entity_type,
    input.entity_id,
    input.order_reference,
    input.reviewer_email
  );

  if (!verification.verified) {
    throw new Error(
      "We could not verify a qualifying purchase for this item with that Order ID and email address."
    );
  }

  const db = getDb();
  const duplicate = db
    .prepare(
      `SELECT id FROM product_reviews
       WHERE entity_type = ? AND entity_id = ?
         AND ((order_id IS NOT NULL AND order_id = ?) OR (commerce_order_id IS NOT NULL AND commerce_order_id = ?))
       LIMIT 1`
    )
    .get(
      input.entity_type,
      input.entity_id,
      verification.orderId || "__none__",
      verification.commerceOrderId || "__none__"
    ) as { id: number } | undefined;

  if (duplicate) {
    throw new Error("A review has already been submitted for this order and product.");
  }

  const info = db
    .prepare(
      `INSERT INTO product_reviews (
        entity_type, entity_id, order_id, commerce_order_id,
        reviewer_name, rating, title, body, verified_purchase, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending')`
    )
    .run(
      input.entity_type,
      input.entity_id,
      verification.orderId,
      verification.commerceOrderId,
      input.reviewer_name,
      input.rating,
      input.title,
      input.body
    );

  const created = db
    .prepare("SELECT * FROM product_reviews WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as Record<string, unknown>;
  return mapReviewRow(created);
}

export function listAdminReviews(statusFilter?: ReviewStatus | "all"): ProductReview[] {
  if (!hasReviewsTable()) return [];
  const db = getDb();
  const where =
    statusFilter && statusFilter !== "all" ? "WHERE status = ?" : "";
  const params = statusFilter && statusFilter !== "all" ? [statusFilter] : [];
  const rows = db
    .prepare(
      `SELECT * FROM product_reviews ${where} ORDER BY created_at DESC, id DESC LIMIT 200`
    )
    .all(...params) as Record<string, unknown>[];
  return rows.map(mapReviewRow);
}

export function moderateProductReview(id: number, status: ReviewStatus): ProductReview | null {
  if (!hasReviewsTable()) return null;
  const db = getDb();
  db.prepare(
    "UPDATE product_reviews SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(status, id);
  const row = db
    .prepare("SELECT * FROM product_reviews WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapReviewRow(row) : null;
}
