/**
 * Admin Private Label Studio — Quote Detail & CAS Price Override API
 *
 * GET   /api/v1/admin/private-label/quotes/:id — Full 12-component itemized quotation breakdown
 * PATCH /api/v1/admin/private-label/quotes/:id — CAS review/override: margins, freight, tooling, status to firm
 */

import { NextResponse } from "next/server";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { PrivateLabelService } from "@/lib/private-label/service";
import { adminUpdateQuoteSchema } from "@/lib/private-label/schemas";
import {
  PrivateLabelRevisionConflictError,
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
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
  if (!id?.trim()) return notFound("Quote ID is required.");

  try {
    const quote = PrivateLabelService.getQuoteAdmin(id);
    return NextResponse.json({ ...quote, quote }, { status: 200 });
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return notFound(error.message);
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Quote ID is required.");

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

  const parsed = adminUpdateQuoteSchema.safeParse(rawBody);
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
    // If status transition to firm_issued requested without overriding line items
    if (parsed.data.status === "firm_issued" && !parsed.data.tea_subtotal_paise && !parsed.data.packaging_subtotal_paise) {
      const validityDays = parsed.data.extend_validity_days ?? 14;
      const updated = PrivateLabelService.issueFirmQuote(id, validityDays, actor, expectedRevision);
      return NextResponse.json({ ...updated, quote: updated }, { status: 200 });
    }

    const updated = PrivateLabelService.overrideQuotePrice(
      id,
      {
        tea_subtotal_paise: parsed.data.tea_subtotal_paise,
        packaging_subtotal_paise: parsed.data.packaging_subtotal_paise,
        printing_subtotal_paise: parsed.data.printing_subtotal_paise,
        tooling_setup_paise: parsed.data.tooling_setup_paise,
        labor_subtotal_paise: parsed.data.labor_subtotal_paise,
        qc_subtotal_paise: parsed.data.qc_subtotal_paise,
        freight_paise: parsed.data.freight_paise,
        margin_paise: parsed.data.margin_paise,
        status: parsed.data.status,
        extend_validity_days: parsed.data.extend_validity_days,
        operator_notes: parsed.data.operator_notes,
      },
      actor,
      expectedRevision
    );

    return NextResponse.json({ ...updated, quote: updated }, { status: 200 });
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
    if (error instanceof PrivateLabelGateError) {
      return NextResponse.json(
        {
          error: error.message,
          gate_name: error.gate_name,
          blockers: error.blockers,
        },
        { status: 422 }
      );
    }
    const message = error instanceof Error ? error.message : "Unable to update quote.";
    if (/sqlite|database|constraint|unique|foreign|syntax|table|column|abort/i.test(message)) {
      return conflict(message);
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
