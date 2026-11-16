import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { listAdminB2BOffers, upsertB2BOffer } from "@/lib/business/repository";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  return NextResponse.json({ offers: listAdminB2BOffers() });
}

export async function PUT(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const user = getAdminUser(req);
    const offer = upsertB2BOffer(body, user?.username || "admin");
    return NextResponse.json({ offer }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return invalid(err.issues[0]?.message || "Invalid B2B offer.");
    }
    return invalid(err instanceof Error ? err.message : "Failed to update B2B offer.");
  }
}
