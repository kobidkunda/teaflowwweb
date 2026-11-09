/**
 * Admin Trial Audit History API
 *
 * GET /api/v1/admin/trials/:id/history
 * Returns chronological immutable audit trail capturing actor, revision,
 * timestamp, action, and JSON diffs for all trial mutations.
 */

import { NextResponse } from "next/server";
import { guard, notFound } from "@/lib/adminHttp";
import { TrialService } from "@/lib/trials/service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!id?.trim()) return notFound("Trial ID is required.");

  const trial = TrialService.getById(id) || TrialService.getBySlug(id);
  if (!trial) return notFound(`Trial not found: ${id}`);

  try {
    const history = TrialService.getHistory(trial.id);
    return NextResponse.json(history, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve trial history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
