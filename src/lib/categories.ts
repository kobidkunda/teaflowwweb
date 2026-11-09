import { getDb } from "@/lib/db";
import { idempotent } from "@/lib/adminStore";
import type { CategoryInput } from "@/lib/validation";
export type Category = {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  description?: string;
  cover_image_url?: string | null;
  parent_id?: number | null;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_override?: string | null;
  noindex?: number;
};
export function listCategories(opts: { activeOnly?: boolean; limit?: number; cursor?: number } = {}): Category[] {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts.activeOnly) clauses.push("is_active = 1");
  if (opts.cursor) { clauses.push("id > ?"); params.push(opts.cursor); }
  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  return getDb().prepare("SELECT * FROM categories" + where + " ORDER BY sort_order ASC, id ASC LIMIT ?").all(...params, limit) as Category[];
}
export function getCategory(id: number): Category | null {
  return (getDb().prepare("SELECT * FROM categories WHERE id=?").get(id) as Category | undefined) ?? null;
}
export function getCategoryBySlug(slug: string): Category | null {
  return (getDb().prepare("SELECT * FROM categories WHERE slug=?").get(slug) as Category | undefined) ?? null;
}
export function deleteCategoryBySlug(slug: string): boolean {
  const cat = getCategoryBySlug(slug);
  if (!cat) return false;
  return deleteCategory(cat.id);
}
export function createCategory(input: CategoryInput): Category {
  const db = getDb();
  const info = db.prepare("INSERT INTO categories (slug, name, sort_order, is_active, description, cover_image_url, parent_id) VALUES (?,?,?,?,?,?,?)")
    .run(input.slug, input.name, input.sort_order, input.is_active, input.description ?? "", input.cover_image_url ?? null, input.parent_id ?? null);
  return getCategory(Number(info.lastInsertRowid))!;
}
export function updateCategory(id: number, input: Partial<CategoryInput>): Category | null {
  const db = getDb();
  const cur = getCategory(id);
  if (!cur) return null;
  db.prepare("UPDATE categories SET slug=COALESCE(?,slug), name=COALESCE(?,name), sort_order=COALESCE(?,sort_order), is_active=COALESCE(?,is_active), description=COALESCE(?,description), cover_image_url=COALESCE(?,cover_image_url), parent_id=COALESCE(?,parent_id) WHERE id=?")
    .run(input.slug ?? null, input.name ?? null, input.sort_order ?? null, input.is_active ?? null, input.description ?? null, input.cover_image_url ?? null, input.parent_id ?? null, id);
  return getCategory(id);
}
export function deleteCategory(id: number): boolean {
  const db = getDb();
  const used = db.prepare("SELECT COUNT(*) AS n FROM products WHERE category_id=?").get(id) as { n: number };
  if (used.n > 0) throw new Error("Category is in use by products.");
  return db.prepare("DELETE FROM categories WHERE id=?").run(id).changes > 0;
}
// Canonical upsert (slug-keyed). Replay on idempotencyKey returns the original.
export function upsertCategory(input: CategoryInput): { id: number; slug: string; deduped: boolean } {
  const { body, deduped } = idempotent("category", input.idempotencyKey, () => {
    const db = getDb();
    db.prepare([
      "INSERT INTO categories (slug, name, sort_order, is_active, description, cover_image_url, parent_id)",
      "VALUES (?,?,?,?,?,?,?)",
      "ON CONFLICT(slug) DO UPDATE SET name=excluded.name, sort_order=excluded.sort_order, is_active=excluded.is_active, description=excluded.description, cover_image_url=excluded.cover_image_url, parent_id=excluded.parent_id",
    ].join(" ")).run(input.slug, input.name, input.sort_order, input.is_active, input.description ?? "", input.cover_image_url ?? null, input.parent_id ?? null);
    const row = db.prepare("SELECT id, slug FROM categories WHERE slug=?").get(input.slug) as { id: number; slug: string };
    return row;
  });
  return { ...body, deduped };
}
