import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, notFound } from "@/lib/adminHttp";
import {
  getProjectByIdOrPublicId,
  updateProjectWorkflow,
} from "@/lib/blend-lab/projects";

export const runtime = "nodejs";

const patchProjectSchema = z.object({
  workflowState: z.string().min(1).max(50).optional(),
  paymentState: z.string().min(1).max(50).optional(),
  notes: z.string().max(2000).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const project = getProjectByIdOrPublicId(id);
  if (!project) return notFound("Project not found.");

  return NextResponse.json({ project });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchProjectSchema.safeParse(body);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  try {
    const project = updateProjectWorkflow(id, parsed.data);
    return NextResponse.json({ project });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Could not update project.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
