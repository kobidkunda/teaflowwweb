import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { conflict, guard, invalid, notFound } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import {
  BusinessNotFoundError,
  getAdminB2BLeadDetail,
  LeadTransitionError,
  transitionB2BLeadStatus,
} from "@/lib/business/repository";

export const runtime = "nodejs";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = guard(req);
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const detail = getAdminB2BLeadDetail(id);
    return NextResponse.json(detail);
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      return notFound(err.message);
    }
    return invalid("Unable to load lead.");
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = guard(req);
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const user = getAdminUser(req);
    const lead = transitionB2BLeadStatus(id, body, user?.username || "admin");
    return NextResponse.json({ lead });
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      return notFound(err.message);
    }
    if (err instanceof LeadTransitionError) {
      return conflict(err.message);
    }
    if (err instanceof ZodError) {
      return invalid(err.issues[0]?.message || "Invalid lead transition.");
    }
    return invalid(err instanceof Error ? err.message : "Failed to update lead.");
  }
}
