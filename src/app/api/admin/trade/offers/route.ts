import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import {
  deleteTradeOffer,
  listAllTradeOffersAdmin,
  upsertTradeOffer,
} from "@/lib/trade/catalogue";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  return NextResponse.json({ offers: listAllTradeOffersAdmin() });
}

export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const offer = upsertTradeOffer(body);
    return NextResponse.json({ offer }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return invalid(err.issues[0]?.message || "Invalid offer payload.");
    }
    return invalid(err instanceof Error ? err.message : "Failed to save trade offer.");
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const productId = Number(req.nextUrl.searchParams.get("productId"));
  if (!Number.isInteger(productId) || productId <= 0) {
    return invalid("Valid productId is required.");
  }
  const deleted = deleteTradeOffer(productId);
  return NextResponse.json({ ok: deleted });
}
