import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import { GET } from "@/app/api/admin/trade/route";
import { upsertProduct } from "@/lib/products";
import { productSchema, normalizeProductInput } from "@/lib/validation";

describe("GET /api/admin/trade", () => {
  let env: TestEnv;
  let cookie: string;
  let id: number;
  beforeAll(() => {
    env = setupAdminTestEnv();
    cookie = getAuthCookie(env.db);
    id = upsertProduct(productSchema.parse(normalizeProductInput({ slug: "trade-tea", name: "Trade Tea", status: "draft" }))).id;
    env.db.prepare("UPDATE products SET is_enabled=0 WHERE id=?").run(id);
    env.db.prepare("INSERT INTO variants (product_id, sku, grams, price_paise, stock) VALUES (?, ?, ?, ?, ?)").run(id, "TRADE-100", 100, 19900, 5);
  });
  afterAll(() => env.cleanup());

  it("requires authentication", async () => {
    expect((await GET(new Request("http://localhost/api/admin/trade"))).status).toBe(401);
  });

  it("returns products with is_enabled and their variants", async () => {
    const response = await GET(new Request("http://localhost/api/admin/trade", { headers: { Cookie: cookie } }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.products).toEqual(expect.arrayContaining([expect.objectContaining({ id, slug: "trade-tea", is_enabled: 0 })]));
    expect(body.variants).toEqual(expect.arrayContaining([expect.objectContaining({ product_id: id, sku: "TRADE-100" })]));
  });
});
