/**
 * Admin Publication Blocker Gate Validation API
 *
 * GET /api/v1/admin/trials/:id/validate
 * Evaluates whether a trial satisfies all commercial, regulatory, photographic,
 * and 4x50g=200g component invariant launch gates.
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
    const result = TrialService.validate(trial.id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to validate trial publication.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
