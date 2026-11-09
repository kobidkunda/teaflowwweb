import { NextResponse } from "next/server";
import { z } from "zod";
import { getCategory } from "@/lib/categories";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const categoryUpdateSchema = z.object({
  slug: z.string().trim().toLowerCase().min(2).max(60).regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().trim().min(2).max(100).optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
  is_active: z.union([z.boolean(), z.number().int().min(0).max(1)]).transform((v) => (v === true || v === 1 ? 1 : 0)).optional(),
  parent_id: z.coerce.number().int().positive().nullable().optional(),
  cover_image_url: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(2000).optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const catId = Number(id);
  const db = getDb();

  const cols = (db.prepare("PRAGMA table_info(categories)").all() as { name: string }[]).map((c) => c.name);
  const hasParent = cols.includes("parent_id");

  let category: Record<string, unknown> | undefined;
  try {
    category = db.prepare(`
      SELECT c.*,
        ${hasParent ? "p.name AS parent_name," : "NULL AS parent_name,"}
        (SELECT COUNT(*) FROM products WHERE category_id = c.id OR category = c.slug) AS product_count
      FROM categories c
      ${hasParent ? "LEFT JOIN categories p ON c.parent_id = p.id" : ""}
      WHERE c.id = ?
    `).get(catId) as Record<string, unknown> | undefined;
  } catch {
    category = db.prepare("SELECT * FROM categories WHERE id = ?").get(catId) as Record<string, unknown> | undefined;
  }

  if (!category) return notFound("Category not found.");

  // Fetch assigned products
  let products: unknown[] = [];
  try {
    products = db.prepare(`
      SELECT id, slug, name, origin, estate, flush, harvest_date, brew_temp, brew_seconds
      FROM products
      WHERE category_id = ? OR category = (SELECT slug FROM categories WHERE id = ?)
      ORDER BY id DESC
    `).all(catId, catId);
  } catch {
    products = [];
  }

  // Fetch child subcategories if any
  let subcategories: unknown[] = [];
  try {
    if (hasParent) {
      subcategories = db.prepare(`
        SELECT c.*,
          (SELECT COUNT(*) FROM products WHERE category_id = c.id OR category = c.slug) AS product_count
        FROM categories c
        WHERE c.parent_id = ?
        ORDER BY c.sort_order ASC, c.name ASC
      `).all(catId);
    }
  } catch {
    subcategories = [];
  }

  return NextResponse.json({
    category: {
      ...category,
      products,
      subcategories,
    },
  });
}

async function handleUpdate(request: Request, params: Promise<{ id: string }>) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const catId = Number(id);
  const current = getCategory(catId);
  if (!current) return notFound("Category not found.");

  const body: unknown = await request.json().catch(() => null);
  const parsed = categoryUpdateSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());

  const data = parsed.data;
  const db = getDb();

  // Circular parent check
  if (data.parent_id !== undefined && data.parent_id === catId) {
    return conflict("Category cannot be its own parent.");
  }

  try {
    const cols = (db.prepare("PRAGMA table_info(categories)").all() as { name: string }[]).map((c) => c.name);
    const hasExt = cols.includes("parent_id");

    if (hasExt) {
      db.prepare(`
        UPDATE categories SET
          slug = COALESCE(?, slug),
          name = COALESCE(?, name),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active),
          parent_id = CASE WHEN ? = 1 THEN ? ELSE parent_id END,
          cover_image_url = CASE WHEN ? = 1 THEN ? ELSE cover_image_url END,
          description = COALESCE(?, description)
        WHERE id = ?
      `).run(
        data.slug ?? null,
        data.name ?? null,
        data.sort_order ?? null,
        data.is_active ?? null,
        data.parent_id !== undefined ? 1 : 0,
        data.parent_id ?? null,
        data.cover_image_url !== undefined ? 1 : 0,
        data.cover_image_url ?? null,
        data.description ?? null,
        catId
      );
    } else {
      db.prepare(`
        UPDATE categories SET
          slug = COALESCE(?, slug),
          name = COALESCE(?, name),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active)
        WHERE id = ?
      `).run(
        data.slug ?? null,
        data.name ?? null,
        data.sort_order ?? null,
        data.is_active ?? null,
        catId
      );
    }

    const updated = db.prepare("SELECT * FROM categories WHERE id = ?").get(catId);
    return NextResponse.json({ category: updated });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to update the category.");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleUpdate(request, params);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleUpdate(request, params);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const catId = Number(id);
  const current = getCategory(catId);
  if (!current) return notFound("Category not found.");

  const db = getDb();

  // 1. Category Deletion Dependency Guard: blocks if products assigned (count > 0)
  try {
    const productsCheck = db.prepare(`
      SELECT COUNT(*) AS count
      FROM products
      WHERE category_id = ? OR category = (SELECT slug FROM categories WHERE id = ?)
    `).get(catId, catId) as { count: number } | undefined;

    if (productsCheck && productsCheck.count > 0) {
      return conflict(
        `Category cannot be deleted because ${productsCheck.count} product(s) are assigned to it. Reassign or delete products first.`
      );
    }
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to verify category dependencies.");
  }

  // 2. Subcategory dependency check
  try {
    const cols = (db.prepare("PRAGMA table_info(categories)").all() as { name: string }[]).map((c) => c.name);
    if (cols.includes("parent_id")) {
      const childCheck = db.prepare("SELECT COUNT(*) AS count FROM categories WHERE parent_id = ?").get(catId) as { count: number } | undefined;
      if (childCheck && childCheck.count > 0) {
        return conflict(
          `Category cannot be deleted because ${childCheck.count} subcategory(s) reference it as parent. Reassign subcategories first.`
        );
      }
    }
  } catch {
    // ignore
  }

  const result = db.prepare("DELETE FROM categories WHERE id = ?").run(catId);
  return result.changes > 0 ? new NextResponse(null, { status: 204 }) : notFound("Category not found.");
}
