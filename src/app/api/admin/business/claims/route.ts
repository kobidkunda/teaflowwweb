import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import { listAdminB2BClaims, upsertB2BClaim } from "@/lib/business/repository";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  return NextResponse.json({ claims: listAdminB2BClaims() });
}

export async function PUT(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const claim = upsertB2BClaim(body);
    return NextResponse.json({ claim }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return invalid(err.issues[0]?.message || "Invalid B2B claim.");
    }
    return invalid(err instanceof Error ? err.message : "Failed to update B2B claim.");
  }
}
