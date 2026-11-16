import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import {
  listLocalizedContent,
  upsertLocalizedContent,
} from "@/lib/trade/catalogue";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const locale = req.nextUrl.searchParams.get("locale") || undefined;
  return NextResponse.json({ items: listLocalizedContent(locale) });
}

export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const item = upsertLocalizedContent(body);
    return NextResponse.json({ item }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return invalid(err.issues[0]?.message || "Invalid content payload.");
    }
    return invalid(err instanceof Error ? err.message : "Failed to save localized content.");
  }
}
