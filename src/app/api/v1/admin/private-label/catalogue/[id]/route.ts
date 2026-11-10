/**
 * Admin Private Label Studio — Catalogue Item Detail & Mutation API
 *
 * GET    /api/v1/admin/private-label/catalogue/:id — Full administrative dossier with specs & publish gates
 * PATCH  /api/v1/admin/private-label/catalogue/:id — CAS optimistic revision update (returns 409 on conflict, 422 on gate failure)
 * DELETE /api/v1/admin/private-label/catalogue/:id — Archive packaging variant or tea option (rejects published)
 */

import { NextResponse } from "next/server";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  adminUpdatePackagingSchema,
  adminUpdateTeaOptionSchema,
} from "@/lib/private-label/schemas";
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
  if (!id?.trim()) return notFound("Item ID is required.");

  // Check packaging variant first
  const packaging = PrivateLabelService.getPackagingVariantById(id);
  if (packaging) {
    return NextResponse.json({ ...packaging, variant: packaging, item: packaging }, { status: 200 });
  }

  // Check tea option
  const tea = PrivateLabelService.getTeaOptionAdminById(id);
  if (tea) {
    return NextResponse.json({ ...tea, tea, item: tea }, { status: 200 });
  }

  return notFound(`Catalogue item not found: ${id}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Item ID is required.");

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

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
  };

  // Determine whether this is packaging or tea
  const existingPackaging = PrivateLabelService.getPackagingVariantById(id);
  const existingTea = !existingPackaging ? PrivateLabelService.getTeaOptionAdminById(id) : null;

  if (!existingPackaging && !existingTea) {
    return notFound(`Catalogue item not found: ${id}`);
  }

  try {
    if (existingPackaging) {
      const parsed = adminUpdatePackagingSchema.safeParse(rawBody);
      if (!parsed.success) {
        return invalid(parsed.error.flatten());
      }

      PrivateLabelService.upsertPackagingVariant(
        {
          ...parsed.data,
          id,
        },
        actor,
        expectedRevision
      );

      // Handle compatible print methods synchronization if provided
      if (parsed.data.compatible_print_method_ids) {
        const methods = PrivateLabelService.listPrintMethodsAdmin();
        for (const pm of methods) {
          const isSupported = parsed.data.compatible_print_method_ids.includes(pm.id);
          PrivateLabelService.setPackagingCompatibility(id, pm.id, isSupported, null, actor);
        }
      }

      const refreshed = PrivateLabelService.getPackagingVariantById(id);
      return NextResponse.json({ ...refreshed, variant: refreshed }, { status: 200 });
    }

    if (existingTea) {
      const parsed = adminUpdateTeaOptionSchema.safeParse(rawBody);
      if (!parsed.success) {
        return invalid(parsed.error.flatten());
      }

      PrivateLabelService.upsertTeaOption(
        {
          ...parsed.data,
          id,
        },
        actor,
        expectedRevision
      );

      const refreshed = PrivateLabelService.getTeaOptionAdminById(id);
      return NextResponse.json({ ...refreshed, tea: refreshed }, { status: 200 });
    }

    return notFound(`Catalogue item not found: ${id}`);
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
    if (error instanceof PrivateLabelNotFoundError) {
      return notFound(error.message);
    }
    const message = error instanceof Error ? error.message : "Unable to update catalogue item.";
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
  if (!id?.trim()) return notFound("Item ID is required.");

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
  };

  try {
    const packaging = PrivateLabelService.getPackagingVariantById(id);
    if (packaging) {
      if (packaging.status === "published") {
        return NextResponse.json(
          { error: "Cannot delete a published packaging variant. Must unpublish or archive first." },
          { status: 400 }
        );
      }
      PrivateLabelService.archivePackagingVariant(id, actor);
      return NextResponse.json({ success: true, archived: true }, { status: 200 });
    }

    const tea = PrivateLabelService.getTeaOptionAdminById(id);
    if (tea) {
      PrivateLabelService.upsertTeaOption(
        { ...tea, is_published: false, sample_available: Boolean(tea.sample_available) },
        actor,
        tea.revision
      );
      return NextResponse.json({ success: true, archived: true }, { status: 200 });
    }

    return notFound(`Catalogue item not found: ${id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to archive item.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
