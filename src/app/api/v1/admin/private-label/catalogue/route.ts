/**
 * Admin Private Label Studio — Catalogue Management API
 *
 * GET  /api/v1/admin/private-label/catalogue — List packaging variants, teas, families, or print methods
 * POST /api/v1/admin/private-label/catalogue — Create packaging variant, tea option, or print method
 */

import { NextResponse } from "next/server";
import { guard, invalid, conflict, keyOf } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { idempotent } from "@/lib/adminStore";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  adminCatalogueQuerySchema,
  adminCreatePackagingSchema,
  adminCreateTeaOptionSchema,
  adminUpsertPrintMethodSchema,
} from "@/lib/private-label/schemas";
import {
  PrivateLabelGateError,
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

    const parsed = adminCatalogueQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return invalid(parsed.error.flatten());
    }

    const { entity, status, family_code, search, q, page, limit, sort_by, sort_dir } = parsed.data;
    const searchTerm = search || q;
    const offset = (page - 1) * limit;

    if (entity === "tea") {
      const isPublished = status === "all" ? "all" : status === "published";
      const result = PrivateLabelService.listTeaOptionsAdmin({
        is_published: isPublished,
        search: searchTerm,
        limit,
        offset,
        sortBy: sort_by === "unit_cost_paise" || sort_by === "sku" ? "name" : sort_by,
        sortDir: sort_dir,
      });
      return NextResponse.json(result, { status: 200 });
    }

    if (entity === "print_methods") {
      const items = PrivateLabelService.listPrintMethodsAdmin();
      return NextResponse.json({ items, total: items.length }, { status: 200 });
    }

    if (entity === "families") {
      const items = PrivateLabelService.listPackagingFamiliesAdmin();
      return NextResponse.json({ items, total: items.length }, { status: 200 });
    }

    // Default: packaging
    const result = PrivateLabelService.listPackagingAdmin({
      status,
      familyCode: family_code,
      search: searchTerm,
      limit,
      offset,
      sortBy: sort_by === "name" ? "title" : sort_by,
      sortDir: sort_dir,
    });

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

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
  };

  const bodyObj = rawBody as Record<string, unknown>;
  const entity = (bodyObj.entity as string) || (bodyObj.base_cost_per_kg_paise !== undefined ? "tea" : "packaging");
  const idempotencyKey = keyOf(request, rawBody as { idempotencyKey?: string });

  try {
    if (entity === "tea") {
      const parsed = adminCreateTeaOptionSchema.safeParse(rawBody);
      if (!parsed.success) {
        return invalid(parsed.error.flatten());
      }

      const { body: created, deduped } = idempotent("pl_tea_create", idempotencyKey, () => {
        return PrivateLabelService.upsertTeaOption(parsed.data, actor);
      });

      return NextResponse.json(
        { variant: created, tea: created, deduped },
        { status: deduped ? 200 : 201 }
      );
    }

    if (entity === "print_methods" || entity === "print_method") {
      const parsed = adminUpsertPrintMethodSchema.safeParse(rawBody);
      if (!parsed.success) {
        return invalid(parsed.error.flatten());
      }

      const created = PrivateLabelService.upsertPrintMethod(parsed.data, actor);
      return NextResponse.json({ print_method: created, deduped: false }, { status: 201 });
    }

    // Default: packaging
    const parsed = adminCreatePackagingSchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalid(parsed.error.flatten());
    }

    const { body: created, deduped } = idempotent("pl_pack_create", idempotencyKey, () => {
      const variant = PrivateLabelService.upsertPackagingVariant(parsed.data, actor);

      // Link any compatible print methods provided
      if (parsed.data.compatible_print_method_ids?.length) {
        for (const pmId of parsed.data.compatible_print_method_ids) {
          PrivateLabelService.setPackagingCompatibility(variant.id, pmId, true, null, actor);
        }
      }

      return variant;
    });

    return NextResponse.json(
      { variant: created, packaging: created, deduped },
      { status: deduped ? 200 : 201 }
    );
  } catch (error) {
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
    const message = error instanceof Error ? error.message : "Unable to create catalogue item.";
    if (/sqlite|database|constraint|unique|foreign|syntax|table|column|abort/i.test(message)) {
      return conflict(message);
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
