/**
 * Admin Trial Stage Photography & Assets API
 *
 * POST   /api/v1/admin/trials/:id/assets — Attach photography asset with mandatory alt text and CAS check
 * DELETE /api/v1/admin/trials/:id/assets — Detach photography asset with CAS check
 */

import { NextResponse } from "next/server";
import { guard, invalid, notFound } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { TrialService } from "@/lib/trials/service";
import { attachAssetSchema } from "@/lib/trials/validation";
import {
  TrialRevisionConflictError,
  TrialNotFoundError,
  TrialInvalidStateTransitionError,
  type AuditActor,
} from "@/lib/trials/types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Trial ID is required.");

  const trial = TrialService.getById(id) || TrialService.getBySlug(id);
  if (!trial) return notFound(`Trial not found: ${id}`);

  const rawBody: Record<string, unknown> | null = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  // Normalize url -> asset_url if needed
  if (!rawBody.asset_url && rawBody.url) {
    rawBody.asset_url = rawBody.url;
  }

  const parsed = attachAssetSchema.safeParse(rawBody);
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

  try {
    const updated = TrialService.attachAsset(
      trial.id,
      parsed.data.expected_revision,
      parsed.data,
      actor
    );
    const full = TrialService.getById(trial.id) || updated;
    const assets = (full as { assets?: unknown[] }).assets || [];
    return NextResponse.json({ ...full, trial: full, assets }, { status: 200 });
  } catch (error) {
    if (error instanceof TrialRevisionConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          current_revision: error.current_revision,
          expected_revision: error.expected_revision,
        },
        { status: 409 }
      );
    }
    if (error instanceof TrialNotFoundError) {
      return notFound(error.message);
    }
    if (error instanceof TrialInvalidStateTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Unable to attach asset.";
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
  if (!id?.trim()) return notFound("Trial ID is required.");

  const trial = TrialService.getById(id) || TrialService.getBySlug(id);
  if (!trial) return notFound(`Trial not found: ${id}`);

  const url = new URL(request.url);
  let assetId = url.searchParams.get("asset_id");
  let expectedRevision: number | undefined;

  const rawBody: Record<string, unknown> | null = await request.json().catch(() => null);
  if (rawBody && typeof rawBody === "object") {
    if (rawBody.asset_id) assetId = String(rawBody.asset_id);
    if (rawBody.expected_revision !== undefined) {
      expectedRevision = Number(rawBody.expected_revision);
    }
  }

  if (!assetId?.trim()) {
    return NextResponse.json({ error: "asset_id query parameter or body field is required." }, { status: 400 });
  }

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
  };

  try {
    const updated = TrialService.detachAsset(trial.id, expectedRevision, assetId, actor);
    const full = TrialService.getById(trial.id) || updated;
    const assets = (full as { assets?: unknown[] }).assets || [];
    return NextResponse.json({ success: true, ...full, trial: full, assets }, { status: 200 });
  } catch (error) {
    if (error instanceof TrialRevisionConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          current_revision: error.current_revision,
          expected_revision: error.expected_revision,
        },
        { status: 409 }
      );
    }
    if (error instanceof TrialNotFoundError) {
      return notFound(error.message);
    }
    const message = error instanceof Error ? error.message : "Unable to detach asset.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
