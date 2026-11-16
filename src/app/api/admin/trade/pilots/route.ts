import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import {
  listTradeSharedPilots,
  upsertTradeSharedPilot,
} from "@/lib/trade/catalogue";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  return NextResponse.json({ pilots: listTradeSharedPilots(false) });
}

export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pilot = upsertTradeSharedPilot(body);
    return NextResponse.json({ pilot }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return invalid(err.issues[0]?.message || "Invalid pilot payload.");
    }
    return invalid(err instanceof Error ? err.message : "Failed to save shared pilot.");
  }
}
