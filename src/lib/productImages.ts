import { getDb } from "@/lib/db";
import { idempotent } from "@/lib/adminStore";
import { galleryImageSchema } from "@/lib/validation";
import { parseImageVariantSkus } from "@/lib/imageVariants";
import type { ProductImageInput } from "@/lib/validation";
export type ProductImage = { id: number; product_id: number; url: string; alt_text: string; sort_order: number; is_primary: number; created_at: string; variant_skus?: string[] };
type RawImage = Omit<ProductImage, "variant_skus"> & { variant_skus?: string };
export function mapProductImage(row: RawImage): ProductImage {
  return { ...row, variant_skus: parseImageVariantSkus(row.variant_skus) };
}
export function listProductImages(productId?: number): ProductImage[] {
  const db = getDb();
  const rows = productId
    ? db.prepare("SELECT * FROM product_images WHERE product_id=? ORDER BY sort_order ASC, id ASC").all(productId)
    : db.prepare("SELECT * FROM product_images ORDER BY product_id ASC, sort_order ASC, id ASC LIMIT 200").all();
  return (rows as RawImage[]).map(mapProductImage);
}
function saveAssignments(id: number, productId: number, skus?: string[]) {
  if (skus === undefined) return;
  const variants = getDb().prepare("SELECT sku FROM variants WHERE product_id=?").all(productId) as { sku: string }[];
  const allowed = new Set(variants.map((variant) => variant.sku));
  if (skus.some((sku) => !allowed.has(sku))) throw new Error("Select variants belonging to this product.");
  const columns = getDb().prepare("PRAGMA table_info(product_images)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "variant_skus")) {
    if (skus.length) throw new Error("Image variant assignments require the catalogue migration.");
    return;
  }
  getDb().prepare("UPDATE product_images SET variant_skus=? WHERE id=?").run(JSON.stringify(skus), id);
}
export function replaceProductImages(productId: number, rawImages: unknown[]): ProductImage[] {
  const images = rawImages.map((image) => galleryImageSchema.parse(image));
  return getDb().transaction(() => {
    getDb().prepare("DELETE FROM product_images WHERE product_id=?").run(productId);
    images.forEach((image, index) => createProductImage({
      ...image, product_id: productId, alt_text: image.alt_text ?? "",
      sort_order: image.sort_order ?? index, is_primary: image.is_primary ?? 0,
      variant_skus: image.variant_skus ?? [],
    }));
    return listProductImages(productId);
  })();
}
export function primaryImage(productId: number): ProductImage | null {
  return (getDb().prepare("SELECT * FROM product_images WHERE product_id=? ORDER BY is_primary DESC, sort_order ASC LIMIT 1").get(productId) as ProductImage | undefined) ?? null;
}
export function createProductImage(input: ProductImageInput): ProductImage {
  const db = getDb();
  return db.transaction(() => {
    const prod = db.prepare("SELECT id FROM products WHERE id=?").get(input.product_id) as { id: number } | undefined;
    if (!prod) throw new Error("Product not found.");
    if (input.is_primary) db.prepare("UPDATE product_images SET is_primary=0 WHERE product_id=?").run(input.product_id);
    const info = db.prepare("INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES (?,?,?,?,?)")
      .run(input.product_id, input.url, input.alt_text, input.sort_order, input.is_primary);
    const id = Number(info.lastInsertRowid);
    saveAssignments(id, input.product_id, input.variant_skus);
    return mapProductImage(db.prepare("SELECT * FROM product_images WHERE id=?").get(id) as RawImage);
  })();
}
export function updateProductImage(id: number, input: Partial<ProductImageInput>): ProductImage | null {
  const db = getDb();
  return db.transaction(() => {
    const cur = db.prepare("SELECT * FROM product_images WHERE id=?").get(id) as ProductImage | undefined;
    if (!cur) return null;
    const pid = input.product_id ?? cur.product_id;
    if (input.is_primary) db.prepare("UPDATE product_images SET is_primary=0 WHERE product_id=?").run(pid);
    db.prepare("UPDATE product_images SET product_id=COALESCE(?,product_id), url=COALESCE(?,url), alt_text=COALESCE(?,alt_text), sort_order=COALESCE(?,sort_order), is_primary=COALESCE(?,is_primary) WHERE id=?")
      .run(input.product_id ?? null, input.url ?? null, input.alt_text ?? null, input.sort_order ?? null, input.is_primary ?? null, id);
    saveAssignments(id, pid, input.variant_skus ?? (pid !== cur.product_id ? parseImageVariantSkus(cur.variant_skus) : undefined));
    return mapProductImage(db.prepare("SELECT * FROM product_images WHERE id=?").get(id) as RawImage);
  })();
}
export function deleteProductImage(id: number): boolean {
  return getDb().prepare("DELETE FROM product_images WHERE id=?").run(id).changes > 0;
}
// Canonical upsert: replays on idempotencyKey return the original row.
export function upsertProductImage(input: ProductImageInput): { id: number; deduped: boolean } {
  const create = () => createProductImage(input);
  if (!input.idempotencyKey) return { id: create().id, deduped: false };
  const { body, deduped } = idempotent("product-image", input.idempotencyKey, () => ({ id: create().id }));
  return { ...body, deduped };
}
