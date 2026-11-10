/**
 * Admin Private Label Studio — Price Books API
 *
 * GET  /api/v1/admin/private-label/price-books — List price books with active currency & tier summaries
 * POST /api/v1/admin/private-label/price-books — Create new price book with rates & optional volume tiers
 */

import { NextResponse } from "next/server";
import { guard, invalid, conflict, keyOf } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { idempotent } from "@/lib/adminStore";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  adminPriceBookQuerySchema,
  adminCreatePriceBookSchema,
} from "@/lib/private-label/schemas";
import {
  PrivateLabelRevisionConflictError,
  type AuditActor,
} from "@/lib/private-label/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const parsed = adminPriceBookQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return invalid(parsed.error.flatten());
    }

    const result = PrivateLabelService.listPriceBooks(parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const rawBody: unknown = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const parsed = adminCreatePriceBookSchema.safeParse(rawBody);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
  };

  const idempotencyKey = keyOf(request, rawBody as { idempotencyKey?: string });

  try {
    const { body: created, deduped } = idempotent("pl_pb_create", idempotencyKey, () => {
      return PrivateLabelService.upsertPriceBook(parsed.data, actor);
    });

    return NextResponse.json(
      { priceBook: created, ...created, deduped },
      { status: deduped ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof PrivateLabelRevisionConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          current_revision: error.current_revision,
          expected_revision: error.expected_revision,
        },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Unable to create price book.";
    if (/sqlite|database|constraint|unique|foreign|syntax|table|column|abort/i.test(message)) {
      return conflict(message);
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
