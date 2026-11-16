import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import {
  listTradeLanes,
  setTradeLaneActive,
  upsertTradeLane,
} from "@/lib/trade/catalogue";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  return NextResponse.json({ lanes: listTradeLanes(false) });
}

export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const lane = upsertTradeLane(body);
    return NextResponse.json({ lane }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return invalid(err.issues[0]?.message || "Invalid lane payload.");
    }
    return invalid(err instanceof Error ? err.message : "Failed to save lane.");
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const body = (await req.json()) as { id?: string; is_active?: boolean };
    if (!body.id || typeof body.is_active !== "boolean") {
      return invalid("id and is_active (boolean) are required.");
    }
    const ok = setTradeLaneActive(body.id, body.is_active);
    if (!ok) return NextResponse.json({ error: "Lane not found." }, { status: 404 });
    return NextResponse.json({ ok: true, id: body.id, is_active: body.is_active });
  } catch (err) {
    return invalid(err instanceof Error ? err.message : "Failed to toggle lane.");
  }
}
