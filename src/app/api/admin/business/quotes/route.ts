import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { guard, invalid, notFound } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { BusinessNotFoundError, createB2BQuote } from "@/lib/business/repository";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const user = getAdminUser(req);
    const quote = createB2BQuote(body, user?.username || "admin");
    return NextResponse.json({ quote }, { status: 201 });
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      return notFound(err.message);
    }
    if (err instanceof ZodError) {
      return invalid(err.issues[0]?.message || "Invalid quote payload.");
    }
    return invalid(err instanceof Error ? err.message : "Failed to create quote.");
  }
}
