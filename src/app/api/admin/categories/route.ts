import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, conflict, keyOf } from "@/lib/adminHttp";
import { getDb } from "@/lib/db";
import { idempotent } from "@/lib/adminStore";

export const runtime = "nodejs";

const categoryInputSchema = z.object({
  slug: z.string().trim().toLowerCase().min(2).max(60).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only."),
  name: z.string().trim().min(2).max(100),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.union([z.boolean(), z.number().int().min(0).max(1)]).transform((v) => (v === true || v === 1 ? 1 : 0)).default(1),
  parent_id: z.coerce.number().int().positive().nullable().optional(),
  cover_image_url: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(2000).default(""),
  idempotencyKey: z.string().uuid().optional(),
});

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1), 200);
  const db = getDb();

  const cols = (db.prepare("PRAGMA table_info(categories)").all() as { name: string }[]).map((c) => c.name);
  const hasParent = cols.includes("parent_id");

  try {
    const categories = db.prepare(`
      SELECT c.*,
        ${hasParent ? "p.name AS parent_name," : "NULL AS parent_name,"}
        (SELECT COUNT(*) FROM products WHERE category_id = c.id OR category = c.slug) AS product_count,
        ${hasParent ? "(SELECT COUNT(*) FROM categories WHERE parent_id = c.id) AS subcategory_count" : "0 AS subcategory_count"}
      FROM categories c
      ${hasParent ? "LEFT JOIN categories p ON c.parent_id = p.id" : ""}
      ORDER BY c.sort_order ASC, c.id ASC
      LIMIT ?
    `).all(limit);

    return NextResponse.json({ categories });
  } catch {
    const categories = db.prepare("SELECT * FROM categories ORDER BY sort_order ASC, id ASC LIMIT ?").all(limit);
    return NextResponse.json({ categories });
  }
}

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const body: unknown = await request.json().catch(() => null);
  const parsed = categoryInputSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());

  try {
    const data = parsed.data;
    const idempotencyKey = keyOf(request, data);

    const { body: result, deduped } = idempotent("category", idempotencyKey, () => {
      const db = getDb();
      const cols = (db.prepare("PRAGMA table_info(categories)").all() as { name: string }[]).map((c) => c.name);
      const hasExt = cols.includes("parent_id");

      if (data.parent_id) {
        const parent = db.prepare("SELECT id FROM categories WHERE id = ?").get(data.parent_id);
        if (!parent) throw new Error("Parent category not found.");
      }

      if (hasExt) {
        db.prepare(`
          INSERT INTO categories (slug, name, sort_order, is_active, parent_id, cover_image_url, description)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(slug) DO UPDATE SET
            name = excluded.name,
            sort_order = excluded.sort_order,
            is_active = excluded.is_active,
            parent_id = excluded.parent_id,
            cover_image_url = excluded.cover_image_url,
            description = excluded.description
        `).run(
          data.slug,
          data.name,
          data.sort_order,
          data.is_active,
          data.parent_id ?? null,
          data.cover_image_url ?? null,
          data.description || ""
        );
      } else {
        db.prepare(`
          INSERT INTO categories (slug, name, sort_order, is_active)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(slug) DO UPDATE SET
            name = excluded.name,
            sort_order = excluded.sort_order,
            is_active = excluded.is_active
        `).run(data.slug, data.name, data.sort_order, data.is_active);
      }

      const row = db.prepare("SELECT * FROM categories WHERE slug = ?").get(data.slug) as Record<string, unknown>;
      return row;
    });

    return NextResponse.json(result, { status: deduped ? 200 : 201 });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to save the category.");
  }
}
