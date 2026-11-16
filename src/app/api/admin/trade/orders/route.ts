import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import {
  listTradeOrdersAdmin,
  reconcileTradeOrder,
} from "@/lib/trade/catalogue";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  return NextResponse.json({ orders: listTradeOrdersAdmin() });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const order = reconcileTradeOrder(body);
    return NextResponse.json({ order }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return invalid(err.issues[0]?.message || "Invalid reconciliation payload.");
    }
    return invalid(err instanceof Error ? err.message : "Failed to reconcile trade order.");
  }
}
