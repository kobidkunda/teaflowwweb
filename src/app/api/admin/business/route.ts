import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import { getDb } from "@/lib/db";
import {
  getB2BFunnelSummary,
  getB2BSettings,
  listAdminB2BClaims,
  listAdminB2BLeads,
  listAdminB2BOffers,
  listAdminB2BPageContent,
  listB2BOutbox,
  updateB2BSettings,
} from "@/lib/business/repository";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  const db = getDb();
  const products = db
    .prepare("SELECT id, slug, name, category FROM products ORDER BY id ASC")
    .all();

  return NextResponse.json({
    settings: getB2BSettings(),
    offers: listAdminB2BOffers(),
    pageContent: listAdminB2BPageContent(),
    claims: listAdminB2BClaims(),
    leads: listAdminB2BLeads({ limit: 100 }),
    outbox: listB2BOutbox(),
    funnelSummary: getB2BFunnelSummary(),
    catalogProducts: products,
  });
}

export async function PUT(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const settings = updateB2BSettings(body);
    return NextResponse.json({ settings }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return invalid(err.issues[0]?.message || "Invalid B2B settings.");
    }
    return invalid(err instanceof Error ? err.message : "Failed to update B2B settings.");
  }
}
