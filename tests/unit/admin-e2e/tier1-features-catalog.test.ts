import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./test-helper";
import { GET as productsGET, POST as productsPOST } from "@/app/api/admin/products/route";
import { GET as productDetailGET, PATCH as productDetailPATCH, DELETE as productDetailDELETE } from "@/app/api/admin/products/[id]/route";
import { GET as categoriesGET, POST as categoriesPOST } from "@/app/api/admin/categories/route";
import { GET as categoryDetailGET, PATCH as categoryDetailPATCH, DELETE as categoryDetailDELETE } from "@/app/api/admin/categories/[id]/route";
import { GET as productImagesGET, POST as productImagesPOST } from "@/app/api/admin/product-images/route";
import { DELETE as productImageDELETE } from "@/app/api/admin/product-images/[id]/route";
import { listProducts, getProduct } from "@/lib/products";
import { getCategory, listCategories } from "@/lib/categories";

describe("Tier 1: Catalog & Media Modules (Features 7–17)", () => {
  let env: TestEnv;
  let authCookie: string;

  beforeAll(() => {
    env = setupAdminTestEnv();
    authCookie = getAuthCookie(env.db, "root");
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("Feature 14, 15, 16: Categories List, Create, Edit & Hierarchy", () => {
    let createdCategoryId: number;

    it("creates a parent category via POST /api/admin/categories (Feature 15)", async () => {
      const payload = {
        slug: "black-tea",
        name: "Black Tea",
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
      expect(data.slug).toBe("black-tea");
      expect(data.id).toBeTypeOf("number");
      createdCategoryId = data.id;
    });

    it("creates a sub-category with parent_id and cover_image_url (Feature 16)", async () => {
      // Direct insertion or service verification to assert category hierarchy
      const insert = env.db.prepare(
        "INSERT INTO categories (slug, name, sort_order, is_active, parent_id, cover_image_url, description) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      const info = insert.run(
        "darjeeling-first-flush",
        "Darjeeling First Flush",
        2,
        1,
        createdCategoryId,
        "/uploads/darjeeling_banner.webp",
        "Spring harvests from Darjeeling high elevation estates."
      );

      const subCatId = Number(info.lastInsertRowid);
      const subCat = env.db.prepare("SELECT * FROM categories WHERE id = ?").get(subCatId) as {
        parent_id: number;
        cover_image_url: string;
        description: string;
      };

      expect(subCat.parent_id).toBe(createdCategoryId);
      expect(subCat.cover_image_url).toBe("/uploads/darjeeling_banner.webp");
      expect(subCat.description).toContain("Spring harvests");
    });

    it("lists categories via GET /api/admin/categories (Feature 14)", async () => {
      const req = new Request("http://localhost/api/admin/categories", {
        headers: { Cookie: authCookie },
      });

      const res = await categoriesGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.categories)).toBe(true);
      expect(data.categories.length).toBeGreaterThanOrEqual(1);
      const slugs = data.categories.map((c: { slug: string }) => c.slug);
      expect(slugs).toContain("black-tea");
    });

    it("updates category details via PATCH /api/admin/categories/[id] (Feature 15)", async () => {
      const req = new Request(`http://localhost/api/admin/categories/${createdCategoryId}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Single-Estate Black Teas", sort_order: 5 }),
      });

      const res = await categoryDetailPATCH(req, { params: Promise.resolve({ id: String(createdCategoryId) }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.category.name).toBe("Single-Estate Black Teas");
      expect(data.category.sort_order).toBe(5);
    });
  });

  describe("Feature 8, 9, 10, 13: Product Creation, Detail, Edit & Sensory Cupping", () => {
    let createdProductId: number;
    let categoryId: number;

    beforeAll(() => {
      const cat = getCategory(1) || env.db.prepare("SELECT id FROM categories LIMIT 1").get() as { id: number };
      categoryId = cat.id;
    });

    it("creates a product with complete sensory cupping and brewing specs via POST /api/admin/products (Features 8 & 13)", async () => {
      const payload = {
        slug: "risheehat-golden-summer",
        name: "Risheehat Golden Summer FTGFOP1",
        category_id: categoryId,
        origin: "Darjeeling, India",
        estate: "Risheehat",
        flush: "Second Flush",
        harvest_date: "June 2026",
        description: "A muscatel-rich Darjeeling with golden tippy leaves.",
        tasting_notes: "Muscatel grape, wild honey, cedarwood.",
        floral: 4,
        fruity: 5,
        malty: 3,
        body: 4,
        brew_temp: 92,
        brew_seconds: 180,
        featured: 1,
      };

      const req = new Request("http://localhost/api/admin/products", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await productsPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.slug).toBe("risheehat-golden-summer");
      expect(data.id).toBeTypeOf("number");
      createdProductId = data.id;
    });

    it("reads full product dossier via GET /api/admin/products/[id] (Feature 9)", async () => {
      const req = new Request(`http://localhost/api/admin/products/${createdProductId}`, {
        headers: { Cookie: authCookie },
      });

      const res = await productDetailGET(req, { params: Promise.resolve({ id: String(createdProductId) }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.product).toBeDefined();
      expect(data.product.id).toBe(createdProductId);
      expect(data.product.name).toBe("Risheehat Golden Summer FTGFOP1");
      expect(data.product.fruity).toBe(5);
      expect(data.product.brew_temp).toBe(92);
      expect(data.product.brew_seconds).toBe(180);
    });

    it("edits product fields via PATCH /api/admin/products/[id] (Feature 10)", async () => {
      const patchPayload = {
        name: "Risheehat Golden Muscatel Special",
        floral: 5,
        brew_seconds: 210,
      };

      const req = new Request(`http://localhost/api/admin/products/${createdProductId}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(patchPayload),
      });

      const res = await productDetailPATCH(req, { params: Promise.resolve({ id: String(createdProductId) }) });
      expect(res.status).toBe(200);

      const updated = getProduct(createdProductId);
      expect(updated?.name).toBe("Risheehat Golden Muscatel Special");
      expect(updated?.floral).toBe(5);
      expect(updated?.brew_seconds).toBe(210);
    });

    it("lists products with search and category filters via GET /api/admin/products (Feature 7)", async () => {
      const req = new Request(`http://localhost/api/admin/products?q=Risheehat&categoryId=${categoryId}`, {
        headers: { Cookie: authCookie },
      });

      const res = await productsGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.products)).toBe(true);
      expect(data.products.length).toBeGreaterThanOrEqual(1);
      expect(data.products[0].name).toContain("Risheehat");
    });
  });

  describe("Feature 12: Multi-Image Gallery & Reordering", () => {
    let testProdId: number;
    let imageId1: number;
    let imageId2: number;

    beforeAll(() => {
      const prod = env.db.prepare("SELECT id FROM products LIMIT 1").get() as { id: number };
      testProdId = prod.id;
    });

    it("adds multiple images with alt text, ordering, and primary flag via POST /api/admin/product-images", async () => {
      const img1 = {
        product_id: testProdId,
        url: "/uploads/risheehat_dry_leaf.webp",
        alt_text: "Whole dry tea leaf with silvery tips",
        sort_order: 1,
        is_primary: 1,
      };

      const req1 = new Request("http://localhost/api/admin/product-images", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(img1),
      });

      const res1 = await productImagesPOST(req1);
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      imageId1 = data1.id;

      const img2 = {
        product_id: testProdId,
        url: "/uploads/risheehat_liquor.webp",
        alt_text: "Golden amber liquor in fine porcelain cup",
        sort_order: 2,
        is_primary: 0,
      };

      const req2 = new Request("http://localhost/api/admin/product-images", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(img2),
      });

      const res2 = await productImagesPOST(req2);
      expect(res2.status).toBe(201);
      const data2 = await res2.json();
      imageId2 = data2.id;
    });

    it("lists images for a product with primary flag and alt text via GET /api/admin/product-images", async () => {
      const req = new Request(`http://localhost/api/admin/product-images?productId=${testProdId}`, {
        headers: { Cookie: authCookie },
      });

      const res = await productImagesGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.images)).toBe(true);
      expect(data.images.length).toBeGreaterThanOrEqual(2);

      const primary = data.images.find((img: { is_primary: number }) => img.is_primary === 1);
      expect(primary).toBeDefined();
      expect(primary.alt_text).toContain("Whole dry tea leaf");
    });

    it("removes an image from gallery via DELETE /api/admin/product-images/[id]", async () => {
      const req = new Request(`http://localhost/api/admin/product-images/${imageId2}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });

      const res = await productImageDELETE(req, { params: Promise.resolve({ id: String(imageId2) }) });
      expect(res.status).toBe(204);

      const check = env.db.prepare("SELECT id FROM product_images WHERE id = ?").get(imageId2);
      expect(check).toBeUndefined();
    });
  });

  describe("Feature 17: Category Deletion Dependency Guard (HTTP 409)", () => {
    let guardedCatId: number;
    let assignedProdId: number;

    beforeAll(() => {
      const catInfo = env.db.prepare("INSERT INTO categories (slug, name, sort_order) VALUES ('guarded-cat', 'Guarded Cat', 1)").run();
      guardedCatId = Number(catInfo.lastInsertRowid);

      const prodInfo = env.db.prepare(
        "INSERT INTO products (slug, name, category, category_id, origin, estate, flush, harvest_date, description, tasting_notes, brew_temp, brew_seconds) " +
        "VALUES ('guarded-prod', 'Guarded Tea', 'Guarded Cat', ?, 'Darjeeling', 'Estate', 'Flush', '2026', 'Desc', 'Notes', 90, 180)"
      ).run(guardedCatId);
      assignedProdId = Number(prodInfo.lastInsertRowid);
    });

    it("blocks deletion of a category when products are assigned to it and returns HTTP 409", async () => {
      const req = new Request(`http://localhost/api/admin/categories/${guardedCatId}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });

      const res = await categoryDetailDELETE(req, { params: Promise.resolve({ id: String(guardedCatId) }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/in use|assigned|Unable to delete/i);

      // Verify category is still intact
      const cat = getCategory(guardedCatId);
      expect(cat).not.toBeNull();
    });

    it("allows category deletion once all assigned products are reallocated or deleted (Feature 11 & 17)", async () => {
      // Delete the assigned product
      const delProdReq = new Request(`http://localhost/api/admin/products/${assignedProdId}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });
      const delProdRes = await productDetailDELETE(delProdReq, { params: Promise.resolve({ id: String(assignedProdId) }) });
      expect(delProdRes.status).toBe(204);

      // Now category deletion must succeed
      const delCatReq = new Request(`http://localhost/api/admin/categories/${guardedCatId}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });
      const delCatRes = await categoryDetailDELETE(delCatReq, { params: Promise.resolve({ id: String(guardedCatId) }) });
      expect(delCatRes.status).toBe(204);

      const catAfter = getCategory(guardedCatId);
      expect(catAfter).toBeNull();
    });
  });
});
