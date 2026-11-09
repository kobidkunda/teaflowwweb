import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import { PATCH as publish } from "@/app/api/admin/products/[id]/publication/route";
import { PUT as saveImages } from "@/app/api/admin/products/[id]/images/route";
import { PATCH as editProduct, GET as detailGET } from "@/app/api/admin/products/[id]/route";
import { productSchema, normalizeProductInput } from "@/lib/validation";
import { getProduct, listProducts, upsertProduct } from "@/lib/products";
import { listProductImages, updateProductImage } from "@/lib/productImages";
import { getProductImages } from "@/lib/storefront";
import { imagesForVariant } from "@/lib/imageVariants";

describe("Product publication and multi-variant images", () => {
  let env: TestEnv; let cookie: string; let id: number;
  beforeAll(() => {
    env = setupAdminTestEnv(); cookie = getAuthCookie(env.db);
    id = upsertProduct(productSchema.parse(normalizeProductInput({ name: "Image Assignment Tea", slug: "image-assignment-tea", status: "draft", variants: [
      { sku: "IMAGE-50", grams: 50, stock: 5, price_paise: 19900 },
      { sku: "IMAGE-100", grams: 100, stock: 5, price_paise: 29900 },
    ] }))).id;
  });
  afterAll(() => env.cleanup());
  const request = (path: string, method: string, body: unknown, authorized = true) => new Request(`http://localhost/api/admin/products/${id}/${path}`, {
    method, headers: { "Content-Type": "application/json", ...(authorized ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
  });
  const params = () => ({ params: Promise.resolve({ id: String(id) }) });
  const images = [
    { url: "/images/50.jpg", alt_text: "50g pack", sort_order: 0, is_primary: 1, variant_skus: ["IMAGE-50"] },
    { url: "/images/100.jpg", alt_text: "100g pack", sort_order: 1, variant_skus: ["IMAGE-100"] },
    { url: "/images/leaf.jpg", alt_text: "Tea leaf", sort_order: 2, variant_skus: ["IMAGE-50", "IMAGE-100"] },
    { url: "/images/shared.jpg", alt_text: "Shared image", sort_order: 3, variant_skus: [] },
  ];
  it("requires authentication and validates publication status", async () => {
    expect((await publish(request("publication", "PATCH", { status: "published" }, false), params())).status).toBe(401);
    expect((await publish(request("publication", "PATCH", { status: "live" }), params())).status).toBe(400);
    expect((await publish(request("publication", "PATCH", { status: "published", stock: 99 }), params())).status).toBe(400);
    expect(getProduct(id)?.status).toBe("draft");
  });
  it("makes a disabled draft live and supports moving it back to draft without changing packs", async () => {
    env.db.prepare("UPDATE products SET is_enabled=0 WHERE id=?").run(id);
    const packs = env.db.prepare("SELECT * FROM variants WHERE product_id=?").all(id);
    expect((await publish(request("publication", "PATCH", { status: "published" }), params())).status).toBe(200);
    expect((await publish(request("publication", "PATCH", { status: "published" }), params())).status).toBe(200);
    expect(getProduct(id)).toMatchObject({ status: "published", is_enabled: 1 });
    expect(listProducts().some((product) => product.id === id)).toBe(true);
    expect(env.db.prepare("SELECT * FROM variants WHERE product_id=?").all(id)).toEqual(packs);
    expect((await publish(request("publication", "PATCH", { status: "draft" }), params())).status).toBe(200);
    expect(listProducts().some((product) => product.id === id)).toBe(false);
  });
  it("saves multi-selection and returns assignments through admin and storefront reads", async () => {
    expect((await saveImages(request("images", "PUT", { images }, false), params())).status).toBe(401);
    expect((await saveImages(request("images", "PUT", { images }), params())).status).toBe(200);
    expect(listProductImages(id).map((image) => image.variant_skus)).toEqual(images.map((image) => image.variant_skus));
    expect(getProductImages(id)[2].variant_skus).toEqual(["IMAGE-50", "IMAGE-100"]);
    const detail = await detailGET(new Request(`http://localhost/api/admin/products/${id}`, { headers: { Cookie: cookie } }), params());
    expect((await detail.json()).product.images[2].variant_skus).toEqual(["IMAGE-50", "IMAGE-100"]);
  });
  it("selects the first matching image and filters other pack images while preserving shared images", () => {
    expect(imagesForVariant(images, "IMAGE-50").map((image) => image.url)).toEqual(["/images/50.jpg", "/images/leaf.jpg", "/images/shared.jpg"]);
    expect(imagesForVariant(images, "IMAGE-100").map((image) => image.url)).toEqual(["/images/100.jpg", "/images/leaf.jpg", "/images/shared.jpg"]);
    expect(imagesForVariant(images, "NO-MATCH").map((image) => image.url)).toEqual(["/images/shared.jpg"]);
    expect(imagesForVariant(images.slice(0, 1), "NO-MATCH")).toEqual(images.slice(0, 1));
    expect(imagesForVariant([], "IMAGE-50")).toEqual([]);
  });
  it("rejects invalid and foreign variant assignments atomically", async () => {
    const before = env.db.prepare("SELECT * FROM product_images WHERE product_id=?").all(id);
    for (const variant_skus of ["IMAGE-50", [42], ["IMAGE-50", "IMAGE-50"], ["OTHER-PRODUCT"]]) {
      expect((await saveImages(request("images", "PUT", { images: [{ ...images[0], variant_skus }] }), params())).status).toBe(400);
      expect(env.db.prepare("SELECT * FROM product_images WHERE product_id=?").all(id)).toEqual(before);
    }
  });
  it("preserves assignments on ordinary product edits and persists them through full product image saves", async () => {
    const response = await editProduct(request("", "PATCH", { description: "Updated operator description." }), params());
    expect(response.status).toBe(200);
    expect(listProductImages(id)[2].variant_skus).toEqual(["IMAGE-50", "IMAGE-100"]);
    expect((await editProduct(request("", "PATCH", { images }), params())).status).toBe(200);
    expect(listProductImages(id)[2].variant_skus).toEqual(["IMAGE-50", "IMAGE-100"]);
    const before = getProduct(id)?.name;
    expect((await editProduct(request("", "PATCH", { name: "Should roll back", images: [{ ...images[0], variant_skus: ["FOREIGN"] }] }), params())).status).toBe(409);
    expect(getProduct(id)?.name).toBe(before);
  });
  it("preserves assignments on migration replay and supports explicit clearing", () => {
    execFileSync(process.execPath, ["--input-type=module", "-e", `import Database from 'better-sqlite3'; import { up } from './scripts/migrations/029_product_image_variants.mjs'; const db = new Database(process.env.DATABASE_PATH); up(db); up(db); db.close();`], { env: { ...process.env, DATABASE_PATH: env.dbPath }, stdio: "ignore" });
    const image = listProductImages(id)[2];
    expect(image.variant_skus).toEqual(["IMAGE-50", "IMAGE-100"]);
    expect(updateProductImage(image.id, { variant_skus: [] })?.variant_skus).toEqual([]);
  });
});
