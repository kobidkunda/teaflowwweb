import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, conflict } from "@/lib/adminHttp";
import { getPaymentSettings, updatePaymentSettings } from "@/lib/paymentSettings";

export const runtime = "nodejs";

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  try {
    const settings = getPaymentSettings(url.origin);
    return NextResponse.json({ settings });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to load payment settings.");
  }
}

export async function PUT(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return invalid({ form: ["Invalid request payload."] });
  }

  try {
    const updated = updatePaymentSettings(body);
    return NextResponse.json({ ok: true, settings: updated });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return invalid(e.flatten());
    }
    return conflict(e instanceof Error ? e.message : "Unable to save payment settings.");
  }
}
