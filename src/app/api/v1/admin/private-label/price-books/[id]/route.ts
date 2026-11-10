/**
 * Admin Private Label Studio — Price Book Detail & CAS Mutation API
 *
 * GET    /api/v1/admin/private-label/price-books/:id — Price book details with volume tiers
 * PATCH  /api/v1/admin/private-label/price-books/:id — CAS optimistic update of rates & tiers
 * DELETE /api/v1/admin/private-label/price-books/:id — Archive or delete non-default price book
 */

import { NextResponse } from "next/server";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { PrivateLabelService } from "@/lib/private-label/service";
import { adminUpdatePriceBookSchema } from "@/lib/private-label/schemas";
import {
  PrivateLabelRevisionConflictError,
  PrivateLabelNotFoundError,
  type AuditActor,
} from "@/lib/private-label/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Price book ID is required.");

  const book = PrivateLabelService.getPriceBookById(id);
  if (!book) return notFound(`Price book not found: ${id}`);

  return NextResponse.json({ ...book, priceBook: book }, { status: 200 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Price book ID is required.");

  const rawBody: Record<string, unknown> | null = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const expectedRevision =
    rawBody.expected_revision !== undefined
      ? Number(rawBody.expected_revision)
      : rawBody.expectedRevision !== undefined
      ? Number(rawBody.expectedRevision)
      : undefined;

  if (expectedRevision === undefined || isNaN(expectedRevision)) {
    return NextResponse.json(
      { error: "expected_revision is required for optimistic concurrency control." },
      { status: 400 }
    );
  }

  const parsed = adminUpdatePriceBookSchema.safeParse(rawBody);
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

  try {
    const updated = PrivateLabelService.upsertPriceBook(
      {
        ...parsed.data,
        id,
        name: parsed.data.name || "Default Price Book",
      },
      actor,
      expectedRevision
    );

    return NextResponse.json({ ...updated, priceBook: updated }, { status: 200 });
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
    if (error instanceof PrivateLabelNotFoundError) {
      return notFound(error.message);
    }
    const message = error instanceof Error ? error.message : "Unable to update price book.";
    if (/sqlite|database|constraint|unique|foreign|syntax|table|column|abort/i.test(message)) {
      return conflict(message);
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Price book ID is required.");

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
  };

  try {
    PrivateLabelService.deletePriceBook(id, actor);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete price book.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
