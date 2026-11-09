import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Migration and validation schemas
const { up: migration010Up } = await import(
  "../../scripts/migrations/010_dynamic_media_assets.mjs"
);
const {
  mediaUploadSchema,
  mediaUpdateSchema,
  mediaQuerySchema,
  sitePlacementSchema,
  productImageSchema,
} = await import("../../src/lib/validation");

// Media and upload data access functions
const {
  listMedia,
  getMediaById,
  updateMediaMetadata,
  checkMediaReferences,
  deleteMediaUpload,
  getSitePlacement,
  listSitePlacements,
  upsertSitePlacement,
} = await import("../../src/lib/media");
const {
  saveMediaUpload,
  validateImageUpload,
  UploadValidationError,
  getUploadsDir,
} = await import("../../src/lib/uploads");
const { mapProductRow, listProducts, getProductBySlug } = await import(
  "../../src/lib/products"
);
const { getDb } = await import("../../src/lib/db");

describe("Milestone 1: Database Migration, Media Schema & Data Access Layer", () => {
  describe("1. Additive Database Migration (010_dynamic_media_assets)", () => {
    it("creates/expands media_uploads with all required metadata columns", () => {
      const db = getDb();
      const cols = (
        db.prepare("PRAGMA table_info(media_uploads)").all() as { name: string }[]
      ).map((c) => c.name);

      expect(cols).toContain("id");
      expect(cols).toContain("filename");
      expect(cols).toContain("original_name");
      expect(cols).toContain("url");
      expect(cols).toContain("alt_text");
      expect(cols).toContain("caption");
      expect(cols).toContain("mime_type");
      expect(cols).toContain("file_size");
      expect(cols).toContain("width");
      expect(cols).toContain("height");
      expect(cols).toContain("sort_order");
      expect(cols).toContain("created_at");
      expect(cols).toContain("updated_at");
    });

    it("recreates media_assets view with size_bytes alias and new columns", () => {
      const db = getDb();
      const cols = (
        db.prepare("PRAGMA table_info(media_assets)").all() as { name: string }[]
      ).map((c) => c.name);

      expect(cols).toContain("id");
      expect(cols).toContain("filename");
      expect(cols).toContain("original_name");
      expect(cols).toContain("url");
      expect(cols).toContain("mime_type");
      expect(cols).toContain("file_size");
      expect(cols).toContain("size_bytes");
      expect(cols).toContain("width");
      expect(cols).toContain("height");
      expect(cols).toContain("alt_text");
      expect(cols).toContain("caption");
      expect(cols).toContain("sort_order");
      expect(cols).toContain("created_at");
      expect(cols).toContain("updated_at");
    });

    it("adds media_id foreign key columns across relational entity tables", () => {
      const db = getDb();
      const prodImgCols = (
        db.prepare("PRAGMA table_info(product_images)").all() as { name: string }[]
      ).map((c) => c.name);
      const catCols = (
        db.prepare("PRAGMA table_info(categories)").all() as { name: string }[]
      ).map((c) => c.name);
      const sliderCols = (
        db.prepare("PRAGMA table_info(sliders)").all() as { name: string }[]
      ).map((c) => c.name);
      const blogCols = (
        db.prepare("PRAGMA table_info(blog_posts)").all() as { name: string }[]
      ).map((c) => c.name);

      expect(prodImgCols).toContain("media_id");
      expect(catCols).toContain("media_id");
      expect(sliderCols).toContain("media_id");
      expect(blogCols).toContain("cover_media_id");
    });

    it("creates site_placements table and seeds default home_hero and home_story", () => {
      const db = getDb();
      const cols = (
        db.prepare("PRAGMA table_info(site_placements)").all() as { name: string }[]
      ).map((c) => c.name);
      const hero = db
        .prepare("SELECT * FROM site_placements WHERE section_key = 'home_hero'")
        .get() as any;
      const story = db
        .prepare("SELECT * FROM site_placements WHERE section_key = 'home_story'")
        .get() as any;

      expect(cols).toContain("section_key");
      expect(cols).toContain("media_id");
      expect(cols).toContain("image_url");
      expect(cols).toContain("alt_text");
      expect(cols).toContain("title");
      expect(cols).toContain("subtitle");
      expect(cols).toContain("cta_label");
      expect(cols).toContain("cta_href");
      expect(cols).toContain("updated_at");

      expect(hero).toBeDefined();
      expect(hero.section_key).toBe("home_hero");
      expect(hero.title.startsWith("Closer to the garden")).toBe(true);

      expect(story).toBeDefined();
      expect(story.section_key).toBe("home_story");
      expect(["A little curious?", "Every tea has a story to tell."]).toContain(story.title);
    });

    it("migration 010 up(db) is strictly idempotent when re-executed", () => {
      const memDb = new Database(":memory:");
      // Create tables as they exist before 010
      memDb.exec(`
        CREATE TABLE media_uploads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL UNIQUE,
          url TEXT NOT NULL,
          alt_text TEXT NOT NULL DEFAULT '',
          mime_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE VIEW media_assets AS SELECT id, filename, url, mime_type, file_size AS size_bytes, alt_text, created_at FROM media_uploads;
        CREATE TABLE product_images (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, url TEXT, alt_text TEXT);
        CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, name TEXT, cover_image_url TEXT);
        CREATE TABLE sliders (id INTEGER PRIMARY KEY AUTOINCREMENT, image_url TEXT);
        CREATE TABLE blog_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, cover_image_url TEXT);
      `);

      // Run 010 first time
      expect(() => migration010Up(memDb)).not.toThrow();

      // Check new columns
      const cols = (
        memDb.prepare("PRAGMA table_info(media_uploads)").all() as { name: string }[]
      ).map((c) => c.name);
      expect(cols).toContain("original_name");
      expect(cols).toContain("caption");
      expect(cols).toContain("width");
      expect(cols).toContain("height");
      expect(cols).toContain("updated_at");

      // Run 010 second time (must not throw duplicate column errors)
      expect(() => migration010Up(memDb)).not.toThrow();
      memDb.close();
    });
  });

  describe("2. Zod Validation Schemas", () => {
    it("mediaUploadSchema validates input and populates defaults", () => {
      const parsed = mediaUploadSchema.parse({});
      expect(parsed.alt_text).toBe("");
      expect(parsed.caption).toBe("");
      expect(parsed.sort_order).toBe(0);

      const custom = mediaUploadSchema.parse({
        alt_text: "Golden Assam tips in porcelain cup",
        caption: "Second flush orthodox harvest",
        sort_order: 5,
      });
      expect(custom.alt_text).toBe("Golden Assam tips in porcelain cup");
      expect(custom.caption).toBe("Second flush orthodox harvest");
      expect(custom.sort_order).toBe(5);
    });

    it("mediaUpdateSchema accepts partial updates and rejects empty bodies", () => {
      const parsed = mediaUpdateSchema.parse({ alt_text: "New alt text" });
      expect(parsed.alt_text).toBe("New alt text");

      const parsedOrder = mediaUpdateSchema.parse({ sort_order: 2 });
      expect(parsedOrder.sort_order).toBe(2);

      const invalidEmpty = mediaUpdateSchema.safeParse({});
      expect(invalidEmpty.success).toBe(false);
    });

    it("mediaQuerySchema validates pagination, search and MIME filter", () => {
      const parsed = mediaQuerySchema.parse({
        cursor: "15",
        limit: "25",
        search: "darjeeling",
        mime_type: "image/webp",
      });
      expect(parsed.cursor).toBe(15);
      expect(parsed.limit).toBe(25);
      expect(parsed.search).toBe("darjeeling");
      expect(parsed.mime_type).toBe("image/webp");

      const invalidMime = mediaQuerySchema.safeParse({
        mime_type: "image/gif",
      });
      expect(invalidMime.success).toBe(false);
    });

    it("sitePlacementSchema enforces valid section_keys and structure", () => {
      const valid = sitePlacementSchema.parse({
        section_key: "home_hero",
        media_id: 1,
        image_url: "/uploads/hero.jpg",
        alt_text: "Hero banner",
        title: "Fine Tea",
      });
      expect(valid.section_key).toBe("home_hero");
      expect(valid.media_id).toBe(1);

      const validNullMedia = sitePlacementSchema.parse({
        section_key: "home_story",
        media_id: null,
      });
      expect(validNullMedia.media_id).toBeNull();

      const invalidSection = sitePlacementSchema.safeParse({
        section_key: "invalid_section",
      });
      expect(invalidSection.success).toBe(false);
    });

    it("productImageSchema supports optional media_id", () => {
      const withMedia = productImageSchema.parse({
        product_id: 1,
        media_id: 42,
        url: "/uploads/tin.jpg",
        alt_text: "Product Tin",
      });
      expect(withMedia.media_id).toBe(42);

      const withoutMedia = productImageSchema.parse({
        product_id: 1,
        url: "/uploads/tin.jpg",
        alt_text: "Product Tin",
      });
      expect(withoutMedia.media_id).toBeUndefined();
    });
  });

  describe("3. Data Access Layer & Safe Deletion", () => {
    let testAssetId: number;
    let testFilename: string;

    beforeAll(async () => {
      // Create a test 1x1 PNG image buffer
      const png1x1 = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      );
      const saved = await saveMediaUpload({
        fileBuffer: png1x1,
        originalFilename: "sample_unit_test.png",
        declaredMimeType: "image/png",
        altText: "Unit test sample image",
        caption: "Test caption metadata",
        sortOrder: 10,
        width: 1,
        height: 1,
      });
      testAssetId = saved.id;
      testFilename = saved.filename;
    });

    it("getMediaById retrieves asset by ID with all metadata", () => {
      const asset = getMediaById(testAssetId);
      expect(asset).not.toBeNull();
      expect(asset!.id).toBe(testAssetId);
      expect(asset!.original_name).toBe("sample_unit_test.png");
      expect(asset!.alt_text).toBe("Unit test sample image");
      expect(asset!.caption).toBe("Test caption metadata");
      expect(asset!.width).toBe(1);
      expect(asset!.height).toBe(1);
    });

    it("updateMediaMetadata updates alt_text, caption, and sort_order", () => {
      const updated = updateMediaMetadata(testAssetId, {
        alt_text: "Updated alt text",
        caption: "Updated caption",
        sort_order: 99,
      });
      expect(updated.alt_text).toBe("Updated alt text");
      expect(updated.caption).toBe("Updated caption");
      expect(updated.sort_order).toBe(99);

      const fetched = getMediaById(testAssetId);
      expect(fetched!.alt_text).toBe("Updated alt text");
      expect(fetched!.caption).toBe("Updated caption");
    });

    it("listMedia filters by search query and mime_type and supports pagination", () => {
      const listAll = listMedia();
      expect(listAll.total).toBeGreaterThanOrEqual(1);
      expect(listAll.items.length).toBeGreaterThanOrEqual(1);

      const listPng = listMedia({ mime_type: "image/png" });
      expect(listPng.some((a) => a.id === testAssetId)).toBe(true);

      const listSearch = listMedia({ search: "sample_unit_test" });
      expect(listSearch.some((a) => a.id === testAssetId)).toBe(true);

      const listNonExistent = listMedia({ search: "non-existent-filename-xyz" });
      expect(listNonExistent.total).toBe(0);
      expect(listNonExistent.items.length).toBe(0);
    });

    it("site placements API (getSitePlacement, upsertSitePlacement, listSitePlacements)", () => {
      const placement = upsertSitePlacement({
        section_key: "shop_hero",
        media_id: testAssetId,
        image_url: `/uploads/${testFilename}`,
        alt_text: "Shop Collection Banner",
        title: "Explore the Terroirs",
        subtitle: "Single estate harvest teas",
        cta_label: "View All",
        cta_href: "/shop",
      });
      expect(placement.section_key).toBe("shop_hero");
      expect(placement.media_id).toBe(testAssetId);

      const fetched = getSitePlacement("shop_hero");
      expect(fetched).not.toBeNull();
      expect(fetched!.title).toBe("Explore the Terroirs");

      const allPlacements = listSitePlacements();
      expect(allPlacements.some((p) => p.section_key === "shop_hero")).toBe(true);
    });

    it("checkMediaReferences detects in-use references across tables", () => {
      // testAssetId is referenced by shop_hero in site_placements
      const refCheck = checkMediaReferences(testAssetId);
      expect(refCheck.inUse).toBe(true);
      expect(refCheck.totalReferences).toBeGreaterThanOrEqual(1);
      expect(refCheck.breakdown.sitePlacements).toBeGreaterThanOrEqual(1);
    });

    it("deleteMediaUpload blocks deletion when asset is referenced", async () => {
      await expect(deleteMediaUpload(testAssetId)).rejects.toThrow(
        /Cannot delete media asset: currently referenced/
      );
    });

    it("deleteMediaUpload deletes unreferenced asset from DB and disk", async () => {
      // Upload a separate unreferenced asset
      const png1x1 = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      );
      const unreferenced = await saveMediaUpload({
        fileBuffer: png1x1,
        originalFilename: "to_delete_test.png",
        declaredMimeType: "image/png",
        altText: "To delete image",
      });

      const unrefCheck = checkMediaReferences(unreferenced.id);
      expect(unrefCheck.inUse).toBe(false);
      expect(unrefCheck.totalReferences).toBe(0);

      const filePath = path.join(getUploadsDir(), unreferenced.filename);
      expect(fs.existsSync(filePath)).toBe(true);

      const delResult = await deleteMediaUpload(unreferenced.id);
      expect(delResult.success).toBe(true);
      expect(delResult.filename).toBe(unreferenced.filename);

      // Verify row is removed from DB
      expect(getMediaById(unreferenced.id)).toBeNull();

      // Verify file is unlinked from disk
      expect(fs.existsSync(filePath)).toBe(false);

      // Clean up test placement reference to testAssetId so we can safely delete it too
      const db = getDb();
      db.prepare("DELETE FROM site_placements WHERE section_key = 'shop_hero'").run();
      await deleteMediaUpload(testAssetId);
    });
  });

  describe("4. Product Model & Hydration", () => {
    it("mapProductRow maps raw product rows and accepts primary_image", () => {
      const mockRaw: any = {
        id: 1,
        slug: "test-tea",
        name: "Test Himalayan Tea",
        category: "Black",
        origin: "Darjeeling",
        estate: "Risheehat",
        flush: "First Flush",
        harvest_date: "2026",
        description: "Test description",
        tasting_notes: "Floral, honey",
        brew_temp: 90,
        brew_seconds: 180,
      };

      const unhydrated = mapProductRow(mockRaw, []);
      expect(unhydrated.primary_image).toBeNull();
      expect(unhydrated.primary_image_url).toBeUndefined();

      const hydrated = mapProductRow(mockRaw, [], {
        url: "/uploads/test.jpg",
        alt_text: "Alt text for tea",
      });
      expect(hydrated.primary_image).toEqual({
        url: "/uploads/test.jpg",
        alt_text: "Alt text for tea",
      });
      expect(hydrated.primary_image_url).toBe("/uploads/test.jpg");
    });

    it("hydrate joins primary image from product_images table", () => {
      const darjeeling = getProductBySlug("darjeeling-spring");
      expect(darjeeling).not.toBeNull();
      expect(darjeeling!.primary_image).toBeDefined();
      expect(darjeeling!.primary_image!.url).toMatch(
        /^\/uploads\/(product-darjeeling-tin\.jpg|darjeeling-spring-hero-v2\.webp)$/
      );
      expect(darjeeling!.primary_image!.alt_text).toContain("Darjeeling");
      expect(darjeeling!.primary_image_url).toMatch(
        /^\/uploads\/(product-darjeeling-tin\.jpg|darjeeling-spring-hero-v2\.webp)$/
      );
    });
  });

  describe("5. Seed Script Backfill Verification", () => {
    it("seed script runs cleanly and backfills media_uploads, product_images, and site_placements", () => {
      const db = getDb();
      const mediaCount = (
        db.prepare("SELECT COUNT(*) AS c FROM media_uploads").get() as any
      ).c;
      const prodImgCount = (
        db.prepare("SELECT COUNT(*) AS c FROM product_images").get() as any
      ).c;
      const heroPlacement = db
        .prepare("SELECT * FROM site_placements WHERE section_key = 'home_hero'")
        .get() as any;
      const storyPlacement = db
        .prepare("SELECT * FROM site_placements WHERE section_key = 'home_story'")
        .get() as any;
      const categoriesWithMedia = (
        db
          .prepare(
            "SELECT COUNT(*) AS c FROM categories WHERE media_id IS NOT NULL"
          )
          .get() as any
      ).c;

      expect(mediaCount).toBeGreaterThanOrEqual(10);
      expect(prodImgCount).toBeGreaterThanOrEqual(11);
      expect(heroPlacement.media_id).not.toBeNull();
      expect(heroPlacement.image_url).toMatch(/^\/uploads\//);
      expect(storyPlacement.media_id).not.toBeNull();
      expect(storyPlacement.image_url).toMatch(/^\/uploads\//);
      expect(categoriesWithMedia).toBeGreaterThanOrEqual(4);

      // Verify that listProducts hydrates real primary images for catalog teas
      const products = listProducts();
      expect(products.length).toBeGreaterThanOrEqual(11);
      const first = products.find((p) => p.slug === "darjeeling-spring");
      expect(first).toBeDefined();
      expect(first!.primary_image).toBeDefined();
      expect(first!.primary_image!.url).toMatch(
        /^\/uploads\/(product-darjeeling-tin\.jpg|darjeeling-spring-hero-v2\.webp)$/
      );
      expect(first!.primary_image!.alt_text).toContain("Darjeeling");
    });
  });

  describe("6. Upload Security & Magic Byte Validation", () => {
    it("rejects SVG files even if disguised with .jpg extension", () => {
      const svgBuffer = Buffer.from(
        "<svg xmlns='http://www.w3.org/2000/svg'><circle r='10'/></svg>",
        "utf8"
      );
      expect(() =>
        validateImageUpload(svgBuffer, {
          originalFilename: "malicious.jpg",
          declaredMimeType: "image/jpeg",
        })
      ).toThrow(UploadValidationError);
    });

    it("rejects empty buffer", () => {
      expect(() => validateImageUpload(Buffer.alloc(0))).toThrow(
        "Uploaded file is empty."
      );
    });

    it("rejects file exceeding 5MB limit", () => {
      const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
      expect(() => validateImageUpload(largeBuffer)).toThrow(
        /File size exceeds 5MB limit/
      );
    });
  });
});
