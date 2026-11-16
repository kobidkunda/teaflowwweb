import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import { listAdminB2BPageContent, upsertB2BPageContent } from "@/lib/business/repository";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  return NextResponse.json({ pageContent: listAdminB2BPageContent() });
}

export async function PUT(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const content = upsertB2BPageContent(body);
    return NextResponse.json({ content }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return invalid(err.issues[0]?.message || "Invalid B2B page content.");
    }
    return invalid(err instanceof Error ? err.message : "Failed to update B2B page content.");
  }
}
