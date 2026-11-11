import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupAdminTestEnv, type TestEnv } from "./admin-e2e/test-helper";
import { upsertProduct, getProduct } from "@/lib/products";
import { productSchema, normalizeProductInput } from "@/lib/validation";
import { replaceProductImages } from "@/lib/productImages";
import { GET } from "@/app/api/cart/images/route";
import { TrialService } from "@/lib/trials/service";
import { cartImageKey, getCartItemImage } from "@/lib/cartImageHelper";
import { refreshCartPrices } from "@/lib/cartPricing";
import { CartItemImage } from "@/components/CartItemImage";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

describe("Catalogue-backed cart photos", () => {
  let env: TestEnv;
  let id: number;
  let variantIds: number[];
  const request = (items: unknown) => new Request(`http://localhost/api/cart/images?${new URLSearchParams({ items: JSON.stringify(items) })}`);
  beforeAll(() => {
    env = setupAdminTestEnv();
    id = upsertProduct(productSchema.parse(normalizeProductInput({
      name: "Assam photo regression", slug: "assam-photo-regression", status: "published",
      variants: [
        { sku: "CART-50", grams: 50, stock: 5, price_paise: 10000 },
        { sku: "CART-100", grams: 100, stock: 5, price_paise: 20000 },
      ],
    }))).id;
    variantIds = getProduct(id)!.variants.map((v) => v.id);
    replaceProductImages(id, [
      { url: "/images/cart-50.jpg", is_primary: 1, variant_skus: ["CART-50"] },
      { url: "/images/cart-100.jpg", variant_skus: ["CART-100"] },
    ]);
  });
  afterAll(() => env.cleanup());

  it("resolves saved cart IDs to exact pack images without names or slugs", async () => {
    const response = GET(request(variantIds.map((variantId) => ({ variantId }))));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ images: {
      [`var-${variantIds[0]}`]: "/images/cart-50.jpg",
      [`var-${variantIds[1]}`]: "/images/cart-100.jpg",
    } });
  });
  it("refreshes stale saved prices from published catalogue packs without changing quantities", async () => {
    const url = new URL(request(variantIds.map(variantId => ({ variantId }))).url);
    url.searchParams.set("includePrices", "1");
    const data = await GET(new Request(url)).json();
    expect(data.prices).toEqual({ [`var-${variantIds[0]}`]: 10000, [`var-${variantIds[1]}`]: 20000 });
    const saved = [{ variantId: variantIds[0], pricePaise: 19900, quantity: 9 }];
    expect(refreshCartPrices(saved, data.prices)).toEqual([{ ...saved[0], pricePaise: 10000 }]);
    expect(refreshCartPrices(saved, { [`var-${variantIds[0]}`]: -1 })).toEqual(saved);
    expect(refreshCartPrices(saved, {})).toEqual(saved);
    env.db.prepare("UPDATE variants SET price_paise=3000 WHERE id=?").run(variantIds[0]);
    expect((await GET(new Request(url)).json()).prices[`var-${variantIds[0]}`]).toBe(3000);
  });
  it("uses current uploaded art and hides unpublished or missing products", async () => {
    replaceProductImages(id, [{ url: "/images/replacement.jpg" }]);
    expect((await GET(request([{ variantId: variantIds[0] }])).json()).images[`var-${variantIds[0]}`]).toBe("/images/replacement.jpg");
    env.db.prepare("UPDATE products SET status='draft' WHERE id=?").run(id);
    expect((await GET(request([{ variantId: variantIds[0] }, { variantId: 9999999 }])).json()).images).toEqual({ [`var-${variantIds[0]}`]: null, "var-9999999": null });
    env.db.prepare("UPDATE products SET status='published', is_enabled=0 WHERE id=?").run(id);
    expect((await GET(request([{ variantId: variantIds[0] }])).json()).images[`var-${variantIds[0]}`]).toBeNull();
  });
  it("keeps trial and variant IDs distinct and uses public kit imagery", async () => {
    const lookup = vi.spyOn(TrialService, "getPublicBySlug").mockReturnValue({ hero_image: { url: "/images/kit.jpg" } } as ReturnType<typeof TrialService.getPublicBySlug>);
    expect((await GET(request([{ trialId: "kit-id" }])).json()).images).toEqual({ "trial-kit-id": "/images/kit.jpg" });
    expect(lookup).toHaveBeenCalledWith("kit-id");
    lookup.mockReturnValue(null);
    expect((await GET(request([{ trialId: "draft-kit" }])).json()).images).toEqual({ "trial-draft-kit": null });
    lookup.mockRestore();
    expect(cartImageKey({ variantId: 0, trialId: "kit-id" })).toBe("trial-kit-id");
  });
  it("rejects malformed, ambiguous and oversized requests", () => {
    for (const items of [null, [{ variantId: -1 }], [{ variantId: 1, trialId: "x" }], [{ trialId: "" }], Array(101).fill({ variantId: 1 })]) {
      expect(GET(request(items)).status).toBe(400);
    }
  });
  it("renders an accessible neutral state instead of unrelated photography", () => {
    expect(getCartItemImage({})).toBeNull();
    const html = renderToStaticMarkup(React.createElement(CartItemImage, { src: null, name: "Assam", size: 64, className: "" }));
    expect(html).toContain('aria-label="Image unavailable for Assam"');
    expect(html).not.toContain("<img");
  });
});
