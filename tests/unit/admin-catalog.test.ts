import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, createMockImageBuffer, type TestEnv } from "./admin-e2e/test-helper";
import { GET as productsGET, POST as productsPOST } from "@/app/api/admin/products/route";
import { GET as productDetailGET, PATCH as productDetailPATCH, PUT as productDetailPUT, DELETE as productDetailDELETE } from "@/app/api/admin/products/[id]/route";
import { GET as categoriesGET, POST as categoriesPOST } from "@/app/api/admin/categories/route";
import { GET as categoryDetailGET, PATCH as categoryDetailPATCH, PUT as categoryDetailPUT, DELETE as categoryDetailDELETE } from "@/app/api/admin/categories/[id]/route";
import { POST as uploadsPOST } from "@/app/api/admin/uploads/route";
import { GET as productImagesGET, POST as productImagesPOST } from "@/app/api/admin/product-images/route";
import { DELETE as productImageDELETE } from "@/app/api/admin/product-images/[id]/route";
import { getProduct, listProducts } from "@/lib/products";
import { getCategory, listCategories } from "@/lib/categories";
import EditProductPage from "@/app/admin/products/[id]/edit/page";

describe("Milestone 3: Admin Catalog & Media Modules Unit Tests", () => {
  let env: TestEnv;
  let authCookie: string;
  let testCategoryId: number;
  let testSubCategoryId: number;
  let testProductId: number;

  beforeAll(() => {
    env = setupAdminTestEnv();
    authCookie = getAuthCookie(env.db, "root");
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("Categories CRUD & Deletion Dependency Guard (Features 14–17)", () => {
    it("creates a top-level parent category via POST /api/admin/categories", async () => {
      const payload = {
        slug: "oolong-tea",
        name: "Oolong Tea",
        description: "Semi-oxidised artisan teas from high elevation estates.",
        cover_image_url: "/uploads/oolong_cover.webp",
        sort_order: 10,
        is_active: 1,
      };

      const req = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await categoriesPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.slug).toBe("oolong-tea");
      expect(data.name).toBe("Oolong Tea");
      expect(data.id).toBeTypeOf("number");
      testCategoryId = data.id;
    });

    it("rejects category creation with invalid slug formatting", async () => {
      const payload = {
        slug: "INVALID SLUG WITH SPACES!",
        name: "Invalid Category",
      };

      const req = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await categoriesPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it("creates a sub-category linked to parent_id", async () => {
      const payload = {
        slug: "taiwan-high-mountain-oolong",
        name: "High Mountain Oolong",
        description: "Alishan and Shan Lin Xi harvests.",
        parent_id: testCategoryId,
        sort_order: 1,
        is_active: 1,
      };

      const req = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await categoriesPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.parent_id).toBe(testCategoryId);
      testSubCategoryId = data.id;
    });

    it("lists categories with hierarchy and product counts via GET /api/admin/categories", async () => {
      const req = new Request("http://localhost/api/admin/categories", {
        headers: { Cookie: authCookie },
      });

      const res = await categoriesGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.categories)).toBe(true);

      const sub = data.categories.find((c: { id: number }) => c.id === testSubCategoryId);
      expect(sub).toBeDefined();
      expect(sub.parent_name).toBe("Oolong Tea");
    });

    it("retrieves single category dossier with assigned products via GET /api/admin/categories/[id]", async () => {
      const req = new Request(`http://localhost/api/admin/categories/${testCategoryId}`, {
        headers: { Cookie: authCookie },
      });

      const res = await categoryDetailGET(req, { params: Promise.resolve({ id: String(testCategoryId) }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.category.id).toBe(testCategoryId);
      expect(data.category.name).toBe("Oolong Tea");
      expect(Array.isArray(data.category.products)).toBe(true);
    });

    it("updates category details via PATCH /api/admin/categories/[id]", async () => {
      const patch = {
        name: "Artisan Oolong Teas",
        sort_order: 15,
      };

      const req = new Request(`http://localhost/api/admin/categories/${testCategoryId}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const res = await categoryDetailPATCH(req, { params: Promise.resolve({ id: String(testCategoryId) }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.category.name).toBe("Artisan Oolong Teas");
      expect(data.category.sort_order).toBe(15);
    });

    it("rejects circular parent reference when category attempts to set itself as parent", async () => {
      const patch = {
        parent_id: testCategoryId,
      };

      const req = new Request(`http://localhost/api/admin/categories/${testCategoryId}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const res = await categoryDetailPATCH(req, { params: Promise.resolve({ id: String(testCategoryId) }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain("own parent");
    });

    it("blocks category deletion with 409 conflict when child subcategories reference it", async () => {
      const req = new Request(`http://localhost/api/admin/categories/${testCategoryId}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });

      const res = await categoryDetailDELETE(req, { params: Promise.resolve({ id: String(testCategoryId) }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/subcategory/i);
    });

    it("deletes subcategory successfully when zero products reference it", async () => {
      const req = new Request(`http://localhost/api/admin/categories/${testSubCategoryId}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });

      const res = await categoryDetailDELETE(req, { params: Promise.resolve({ id: String(testSubCategoryId) }) });
      expect(res.status).toBe(204);

      const check = getCategory(testSubCategoryId);
      expect(check).toBeNull();
    });
  });

  describe("Products CRUD & Sensory Cupping Profile (Features 7–11, 13)", () => {
    it("creates a product with complete sensory cupping scores via POST /api/admin/products", async () => {
      const payload = {
        slug: "aryas-ruby-darjeeling",
        name: "Arya Diamond Ruby FTGFOP1",
        category_id: testCategoryId,
        origin: "Darjeeling, India",
        estate: "Arya Tea Estate",
        flush: "Second Flush",
        harvest_date: "July 2026",
        description: "Rare clonal Darjeeling with profound Muscatel and wild rose aroma.",
        tasting_notes: "Muscatel grape, rose petal, wild honey.",
        floral: 5,
        fruity: 4,
        malty: 2,
        body: 3,
        sweetness: 5,
        earthy: 1,
        aroma_tags: ["Muscatel", "Rose Water", "Honey"],
        dry_leaf_appearance: "Twisted dark brown leaves with dense silver tips",
        dry_leaf_grade: "FTGFOP1 Clonal",
        dry_leaf_aroma: "Sweet honeyed rose bouquet",
        liquor_hue_hex: "#c67d34",
        liquor_hue_name: "Ruby Copper",
        liquor_clarity: "Sparkling crystal",
        liquor_body: "Full and velvety",
        wet_leaf_aroma: "Apricot preserves and spicy cedar",
        wet_leaf_oxidation: "Well balanced 60%",
        brew_temp: 95,
        brew_seconds: 240,
        leaf_dose_grams: 2.5,
        water_ml: 200,
        steep_count: 3,
        steep_instructions: "Steep 4 minutes in preheated vessel.",
        elevation_feet: 5500,
        elevation_display: "4,800 – 6,000 ft",
        lot_number: "AR-DJ-05/26",
        cultivar: "AV2 Clonal",
        estate_story: "Arya Estate is situated near Darjeeling town facing the Kanchenjunga peaks.",
        featured: 1,
        variants: [
          {
            sku: "ARYA-RB-100G",
            packaging_format: "loose_leaf_pouch",
            grams: 100,
            price_paise: 95000,
            stock: 30,
            servings: 40,
          },
        ],
      };

      const req = new Request("http://localhost/api/admin/products", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await productsPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.slug).toBe("aryas-ruby-darjeeling");
      expect(data.id).toBeTypeOf("number");
      testProductId = data.id;
    });

    it("rejects sensory scores outside the allowed 0-5 rating scale", async () => {
      const payload = {
        slug: "invalid-cupping-score",
        name: "Score Test Tea",
        category_id: testCategoryId,
        origin: "Darjeeling",
        estate: "Estate",
        flush: "Spring",
        harvest_date: "2026",
        description: "Description",
        tasting_notes: "Notes",
        floral: 9, // Invalid: exceeds max 5
        brew_temp: 90,
        brew_seconds: 180,
      };

      const req = new Request("http://localhost/api/admin/products", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await productsPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it("rejects brewing temperature outside 50–100°C bounds", async () => {
      const payload = {
        slug: "invalid-brew-temp",
        name: "Temp Test Tea",
        origin: "Darjeeling",
        estate: "Estate",
        flush: "Spring",
        harvest_date: "2026",
        description: "Description",
        tasting_notes: "Notes",
        brew_temp: 140, // Invalid: exceeds 100°C
        brew_seconds: 180,
      };

      const req = new Request("http://localhost/api/admin/products", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await productsPOST(req);
      expect(res.status).toBe(400);
    });

    it("reads full product dossier via GET /api/admin/products/[id]", async () => {
      const req = new Request(`http://localhost/api/admin/products/${testProductId}`, {
        headers: { Cookie: authCookie },
      });

      const res = await productDetailGET(req, { params: Promise.resolve({ id: String(testProductId) }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.product.id).toBe(testProductId);
      expect(data.product.name).toBe("Arya Diamond Ruby FTGFOP1");
      expect(data.product.sweetness).toBe(5);
      expect(data.product.floral).toBe(5);
      expect(data.product.variants).toHaveLength(1);
    });

    it("updates product attributes via PUT /api/admin/products/[id]", async () => {
      const updatePayload = {
        name: "Arya Diamond Ruby Special Clonal FTGFOP1",
        brew_seconds: 270,
        sweetness: 4,
      };

      const req = new Request(`http://localhost/api/admin/products/${testProductId}`, {
        method: "PUT",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      const res = await productDetailPUT(req, { params: Promise.resolve({ id: String(testProductId) }) });
      expect(res.status).toBe(200);

      const updated = getProduct(testProductId);
      expect(updated?.name).toBe("Arya Diamond Ruby Special Clonal FTGFOP1");
      expect(updated?.brew_seconds).toBe(270);
    });

    it("lists products with search, category, stock status and sorting via GET /api/admin/products", async () => {
      const req = new Request(
        `http://localhost/api/admin/products?q=Arya&categoryId=${testCategoryId}&stockStatus=in_stock&sort=name_asc`,
        { headers: { Cookie: authCookie } }
      );

      const res = await productsGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.products)).toBe(true);
      expect(data.products.length).toBeGreaterThanOrEqual(1);
      expect(data.products[0].name).toContain("Arya");
      expect(data.total).toBeDefined();
    });

    it("enforces Category Deletion Dependency Guard (HTTP 409) when product is assigned", async () => {
      const req = new Request(`http://localhost/api/admin/categories/${testCategoryId}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });

      const res = await categoryDetailDELETE(req, { params: Promise.resolve({ id: String(testCategoryId) }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/assigned|in use/i);

      // Category remains intact
      expect(getCategory(testCategoryId)).not.toBeNull();
    });
  });

  describe("Media & Multi-Image Gallery (Features 12, 38–40)", () => {
    let uploadedImageUrl: string;
    let createdImageId: number;

    it("uploads an image file via POST /api/admin/uploads", async () => {
      const imageBuffer = createMockImageBuffer("webp", 2048);
      const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/webp" });
      const formData = new FormData();
      formData.append("file", blob, "arya_ruby_leaf.webp");
      formData.append("alt_text", "Whole dry clonal tea leaf");

      const req = new Request("http://localhost/api/admin/uploads", {
        method: "POST",
        headers: { Cookie: authCookie },
        body: formData,
      });

      const res = await uploadsPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.url).toMatch(/^\/uploads\/(upload|media)_/);
      expect(data.alt_text).toBe("Whole dry clonal tea leaf");
      uploadedImageUrl = data.url;
    });

    it("rejects SVG image upload with 400 error", async () => {
      const svgBuffer = createMockImageBuffer("svg");
      const blob = new Blob([new Uint8Array(svgBuffer)], { type: "image/svg+xml" });
      const formData = new FormData();
      formData.append("file", blob, "malicious.svg");

      const req = new Request("http://localhost/api/admin/uploads", {
        method: "POST",
        headers: { Cookie: authCookie },
        body: formData,
      });

      const res = await uploadsPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/SVG|unsupported|not permitted/i);
    });

    it("attaches uploaded image to product via POST /api/admin/product-images", async () => {
      const payload = {
        product_id: testProductId,
        url: uploadedImageUrl,
        alt_text: "Whole dry clonal tea leaf with silver tips",
        sort_order: 1,
        is_primary: 1,
      };

      const req = new Request("http://localhost/api/admin/product-images", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await productImagesPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeTypeOf("number");
      createdImageId = data.id;
    });

    it("lists images for a product with primary flag via GET /api/admin/product-images", async () => {
      const req = new Request(`http://localhost/api/admin/product-images?productId=${testProductId}`, {
        headers: { Cookie: authCookie },
      });

      const res = await productImagesGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.images)).toBe(true);
      expect(data.images.length).toBeGreaterThanOrEqual(1);

      const primary = data.images.find((img: { is_primary: number }) => img.is_primary === 1);
      expect(primary).toBeDefined();
      expect(primary.url).toBe(uploadedImageUrl);
    });

    it("removes an image from product gallery via DELETE /api/admin/product-images/[id]", async () => {
      const req = new Request(`http://localhost/api/admin/product-images/${createdImageId}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });

      const res = await productImageDELETE(req, { params: Promise.resolve({ id: String(createdImageId) }) });
      expect(res.status).toBe(204);
    });
  });

  describe("Safe Product Deletion & Order Dependency Guard (Feature 11)", () => {
    let orderDependentProdId: number;

    beforeAll(() => {
      // Create a product and simulate an order item referencing its variant
      const pInfo = env.db.prepare(
        "INSERT INTO products (slug, name, category, origin, estate, flush, harvest_date, description, tasting_notes, brew_temp, brew_seconds) " +
        "VALUES ('order-dependent-tea', 'Order Dependent Tea', 'Black Tea', 'Assam', 'Estate', 'Summer', '2026', 'Desc', 'Notes', 95, 200)"
      ).run();
      orderDependentProdId = Number(pInfo.lastInsertRowid);

      const vInfo = env.db.prepare(
        "INSERT INTO variants (product_id, sku, grams, price_paise, stock) VALUES (?, 'DEP-100G', 100, 50000, 10)"
      ).run(orderDependentProdId);
      const variantId = Number(vInfo.lastInsertRowid);

      // Create dummy order and order item
      env.db.prepare(
        "INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, shipping_paise, total_paise) " +
        "VALUES ('order-dep-1', 'dep-key-1', 'Customer', 'c@example.com', 'Address 123', 50000, 9900, 59900)"
      ).run();

      env.db.prepare(
        "INSERT INTO order_items (order_id, variant_id, quantity, unit_price_paise) VALUES ('order-dep-1', ?, 1, 50000)"
      ).run(variantId);
    });

    it("blocks product deletion with 409 conflict when orders reference its variants", async () => {
      const req = new Request(`http://localhost/api/admin/products/${orderDependentProdId}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });

      const res = await productDetailDELETE(req, { params: Promise.resolve({ id: String(orderDependentProdId) }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/order item|referenced/i);

      // Product still exists
      expect(getProduct(orderDependentProdId)).not.toBeNull();
    });

    it("allows deletion of product with zero orders via DELETE /api/admin/products/[id]", async () => {
      const req = new Request(`http://localhost/api/admin/products/${testProductId}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });

      const res = await productDetailDELETE(req, { params: Promise.resolve({ id: String(testProductId) }) });
      expect(res.status).toBe(204);

      expect(getProduct(testProductId)).toBeNull();
    });

    it("allows category deletion now that assigned products are deleted", async () => {
      const req = new Request(`http://localhost/api/admin/categories/${testCategoryId}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });

      const res = await categoryDetailDELETE(req, { params: Promise.resolve({ id: String(testCategoryId) }) });
      expect(res.status).toBe(204);

      expect(getCategory(testCategoryId)).toBeNull();
    });

    it("renders EditProductPage Server Component for existing product and handles not-found cleanly", async () => {
      const element = await EditProductPage({ params: Promise.resolve({ id: String(orderDependentProdId) }) });
      expect(element).toBeDefined();

      await expect(
        EditProductPage({ params: Promise.resolve({ id: "999999" }) })
      ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);

      await expect(
        EditProductPage({ params: Promise.resolve({ id: "invalid-id" }) })
      ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    });
  });
});
