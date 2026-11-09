import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import { PATCH } from "@/app/api/admin/products/[id]/availability/route";
import { GET as adminGET } from "@/app/api/admin/products/route";
import { GET as publicGET } from "@/app/api/products/route";
import { getProduct, listProducts, upsertProduct } from "@/lib/products";
import { productSchema, normalizeProductInput } from "@/lib/validation";
import { createDemoOrder } from "@/lib/checkout";
import { getFeedCatalogData } from "@/lib/feeds";
import { getCatalogSitemapEntries } from "@/lib/seo/sitemap";

describe("Product availability", () => {
  let env: TestEnv;
  let cookie: string;
  let id: number;
  let variantId: number;
  beforeAll(() => {
    env = setupAdminTestEnv();
    cookie = getAuthCookie(env.db);
    id = upsertProduct(productSchema.parse(normalizeProductInput({ slug: "availability-tea", name: "Availability Tea", status: "draft" }))).id;
    variantId = Number(env.db.prepare("INSERT INTO variants (product_id, sku, grams, price_paise, stock) VALUES (?, ?, ?, ?, ?)").run(id, "AVAIL-100", 100, 19900, 5).lastInsertRowid);
    env.db.prepare("INSERT INTO product_images (product_id, url, alt_text) VALUES (?, ?, ?)").run(id, "/images/test.jpg", "Test pack");
  });
  afterAll(() => env.cleanup());
  const patch = (body: unknown, authorized = true, target = String(id), origin?: string) => PATCH(new Request(`http://localhost/api/admin/products/${target}/availability`, {
    method: "PATCH", headers: { "Content-Type": "application/json", ...(authorized ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: target }) });

  it("requires authentication and rejects cross-origin saves", async () => {
    expect((await patch({ enabled: false }, false)).status).toBe(401);
    expect((await patch({ enabled: false }, true, String(id), "https://untrusted.example")).status).toBe(403);
    expect(getProduct(id)?.is_enabled).toBe(1);
  });
  it("allows the incoming host behind an internal bind URL", async () => {
    const response = await PATCH(new Request(`http://0.0.0.0/api/admin/products/${id}/availability`, {
      method: "PATCH", headers: { Cookie: cookie, "Content-Type": "application/json", Host: "teafloww.com", Origin: "https://teafloww.com" }, body: JSON.stringify({ enabled: true }),
    }), { params: Promise.resolve({ id: String(id) }) });
    expect(response.status).toBe(200);
  });
  it("rejects invalid bodies and IDs without changing availability", async () => {
    for (const body of [null, {}, { enabled: "false" }, { enabled: 0 }, { enabled: false, stock: 0 }]) {
      expect((await patch(body)).status).toBe(400);
    }
    expect((await patch({ enabled: false }, true, "NaN")).status).toBe(400);
    expect((await patch({ enabled: false }, true, "999999")).status).toBe(404);
    expect(getProduct(id)?.is_enabled).toBe(1);
  });
  it("disables idempotently without rewriting publication state, packs, or images", async () => {
    const variants = env.db.prepare("SELECT * FROM variants WHERE product_id=?").all(id);
    const images = env.db.prepare("SELECT * FROM product_images WHERE product_id=?").all(id);
    expect((await patch({ enabled: false })).status).toBe(200);
    expect((await patch({ enabled: false })).status).toBe(200);
    expect(getProduct(id)).toMatchObject({ status: "draft", is_enabled: 0 });
    expect(env.db.prepare("SELECT * FROM variants WHERE product_id=?").all(id)).toEqual(variants);
    expect(env.db.prepare("SELECT * FROM product_images WHERE product_id=?").all(id)).toEqual(images);
    const response = adminGET(new Request("http://localhost/api/admin/products?status=all", { headers: { Cookie: cookie } }));
    expect((await response.json()).products).toEqual(expect.arrayContaining([expect.objectContaining({ id, is_enabled: 0 })]));
  });
  it("hides disabled published products from public lists and sitemap and rejects saved cart items", async () => {
    env.db.prepare("UPDATE products SET status='published' WHERE id=?").run(id);
    expect(listProducts().some((product) => product.id === id)).toBe(false);
    expect((await publicGET(new Request("http://localhost/api/products?status=all")).json()).products.some((product: { id: number }) => product.id === id)).toBe(false);
    expect(getFeedCatalogData("https://teafloww.com").some((item) => item.link.includes("/tea/availability-tea"))).toBe(false);
    expect(getCatalogSitemapEntries().some((entry) => entry.url.endsWith("/tea/availability-tea"))).toBe(false);
    expect(() => createDemoOrder({ name: "Test Buyer", email: "test@example.com", address: "123 Test Road, Test City", idempotencyKey: randomUUID(), items: [{ variantId, quantity: 1 }] })).toThrow("unavailable");
    expect(env.db.prepare("SELECT stock FROM variants WHERE id=?").get(variantId)).toEqual({ stock: 5 });
  });
  it("preserves disabled state when the product is edited and migration is replayed", async () => {
    upsertProduct(productSchema.parse(normalizeProductInput({ id, slug: "availability-tea", name: "Updated Tea", status: "draft" })));
    execFileSync(process.execPath, ["--input-type=module", "-e", `
      import Database from 'better-sqlite3';
      import { up } from './scripts/migrations/028_product_enabled.mjs';
      const db = new Database(process.env.DATABASE_PATH);
      up(db); up(db); db.close();
    `], { env: { ...process.env, DATABASE_PATH: env.dbPath }, stdio: "ignore" });
    execFileSync(process.execPath, ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_PATH: env.dbPath }, stdio: "ignore" });
    expect(getProduct(id)).toMatchObject({ is_enabled: 0, status: "draft" });
  });
  it("re-enables without publishing drafts and restores published products to the public catalogue", async () => {
    expect((await patch({ enabled: true })).status).toBe(200);
    expect(getProduct(id)).toMatchObject({ is_enabled: 1, status: "draft" });
    expect(listProducts().some((product) => product.id === id)).toBe(false);
    env.db.prepare("UPDATE products SET status='published' WHERE id=?").run(id);
    expect(listProducts().some((product) => product.id === id)).toBe(true);
  });
});
