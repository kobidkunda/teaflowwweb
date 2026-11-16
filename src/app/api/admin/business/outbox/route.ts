import { NextRequest, NextResponse } from "next/server";
import { guard, invalid, notFound } from "@/lib/adminHttp";
import { BusinessNotFoundError, listB2BOutbox, retryB2BOutboxItem } from "@/lib/business/repository";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  const statusParam = req.nextUrl.searchParams.get("status");
  const status =
    statusParam === "pending" ||
    statusParam === "processing" ||
    statusParam === "done" ||
    statusParam === "dead_letter"
      ? statusParam
      : undefined;

  return NextResponse.json({ outbox: listB2BOutbox(status) });
}

export async function POST(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as { id?: string };
    if (!body?.id) return invalid("Outbox id is required.");
    const item = retryB2BOutboxItem(body.id);
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      return notFound(err.message);
    }
    return invalid(err instanceof Error ? err.message : "Failed to retry outbox item.");
  }
}
