/**
 * Admin Trials Management API
 *
 * GET  /api/v1/admin/trials — Query trials with status, search, and pagination
 * POST /api/v1/admin/trials — Create new draft trial with idempotency key
 */

import { NextResponse } from "next/server";
import { guard, invalid, conflict, keyOf } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { idempotent } from "@/lib/adminStore";
import { TrialService } from "@/lib/trials/service";
import { createTrialSchema, trialQuerySchema } from "@/lib/trials/validation";
import type { AuditActor } from "@/lib/trials/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const offsetRaw = url.searchParams.get("offset");
    const pageRaw = url.searchParams.get("page");
    const searchRaw = url.searchParams.get("search") || url.searchParams.get("q");
    const statusRaw = url.searchParams.get("status");
    const sortByRaw = url.searchParams.get("sort_by");
    const sortDirRaw = url.searchParams.get("sort_dir");

    const limit = limitRaw ? parseInt(limitRaw, 10) : 20;
    let offset = offsetRaw ? parseInt(offsetRaw, 10) : 0;
    if (!offsetRaw && pageRaw) {
      const pageNum = Math.max(parseInt(pageRaw, 10) || 1, 1);
      offset = (pageNum - 1) * limit;
    }

    const queryInput = {
      status: (statusRaw as "draft" | "in_review" | "published" | "archived" | "all") || "all",
      search: searchRaw?.trim() || undefined,
      limit,
      offset,
      sort_by: (sortByRaw as "created_at" | "updated_at" | "title" | "price_paise") || undefined,
      sort_dir: (sortDirRaw as "asc" | "desc") || undefined,
    };

    const parsed = trialQuerySchema.safeParse(queryInput);
    if (!parsed.success) {
      return invalid(parsed.error.flatten());
    }

    const result = TrialService.list(parsed.data);
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

  const parsed = createTrialSchema.safeParse(rawBody);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
    user_agent: request.headers.get("user-agent") || null,
  };

  const idempotencyKey = keyOf(request, rawBody as { idempotencyKey?: string });

  try {
    const { body: created, deduped } = idempotent("trial_create", idempotencyKey, () => {
      return TrialService.createDraft(parsed.data, actor);
    });

    return NextResponse.json(
      { ...created, trial: created },
      { status: deduped ? 200 : 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create trial.";
    if (message.includes("already exists") || message.includes("duplicate") || message.includes("UNIQUE")) {
      return conflict(message);
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
