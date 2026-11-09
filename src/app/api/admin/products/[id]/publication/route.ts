import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, notFound } from "@/lib/adminHttp";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
const publicationSchema = z.object({ status: z.enum(["draft", "published"]) }).strict();
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
  const input = publicationSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !input.success) return invalid("A product ID and draft or published status are required.");

  try {
    const db = getDb();
    const result = input.data.status === "published"
      ? db.prepare("UPDATE products SET status=?, is_enabled=1 WHERE id=?").run(input.data.status, id.data)
      : db.prepare("UPDATE products SET status=? WHERE id=?").run(input.data.status, id.data);
    if (!result.changes) return notFound("Product not found.");
    const product = db.prepare("SELECT id, status, is_enabled FROM products WHERE id=?").get(id.data);
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Unable to update publication status. Please try again." }, { status: 500 });
  }
}
