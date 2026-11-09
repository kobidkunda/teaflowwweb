import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, notFound } from "@/lib/adminHttp";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
const availabilitySchema = z.object({ enabled: z.boolean() }).strict();
const idSchema = z.coerce.number().int().positive();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      // Next may use an internal bind URL behind the production reverse proxy.
      const host = request.headers.get("host") ?? new URL(request.url).host;
      if (!["http:", "https:"].includes(source.protocol) || source.host !== host) {
        return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
    }
  }
  const id = idSchema.safeParse((await params).id);
  const input = availabilitySchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !input.success) return invalid("A product ID and boolean enabled value are required.");

  try {
    // Exact assignment makes retries idempotent; no product details are rewritten.
    const result = getDb().prepare("UPDATE products SET is_enabled=? WHERE id=?")
      .run(input.data.enabled ? 1 : 0, id.data);
    if (!result.changes) return notFound("Product not found.");
    return NextResponse.json({ id: id.data, is_enabled: input.data.enabled ? 1 : 0 });
  } catch {
    return NextResponse.json({ error: "Unable to update product availability. Please try again." }, { status: 500 });
  }
}
