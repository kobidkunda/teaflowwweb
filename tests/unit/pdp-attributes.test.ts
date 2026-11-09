import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import Database from "better-sqlite3";

const TEST_DB = path.join(tmpdir(), `pdp-attr-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

const {
  getProductBySlug,
  listProducts,
  upsertProduct,
  upsertVariant,
  parseAromaTags,
  mapProductRow,
  mapVariantRow,
} = await import("../../src/lib/products");

const {
  variantSchema,
  productSchema,
  packagingFormatSchema,
} = await import("../../src/lib/validation");

beforeAll(() => {
  // Execute versioned migrations up to 009
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: TEST_DB },
    stdio: "ignore",
  });
});

afterAll(() => {
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    try {
      rmSync(TEST_DB + suffix, { force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("Suite 1: Database Migration 009 & Idempotency", () => {
  it("records 009_teabox_pdp_variants_cupping in schema_migrations", () => {
    const db = new Database(TEST_DB, { readonly: true });
    const applied = db
      .prepare("SELECT version FROM schema_migrations WHERE version=?")
      .get("009_teabox_pdp_variants_cupping");
    db.close();

    expect(applied).toBeDefined();
  });

  it("adds all 21 cupping, steeping, and terroir columns to products table", () => {
    const db = new Database(TEST_DB, { readonly: true });
    const cols = db.prepare("PRAGMA table_info(products)").all().map((c) => (c as { name: string }).name);
    db.close();

    const expectedCols = [
      "dry_leaf_appearance",
      "dry_leaf_grade",
      "dry_leaf_aroma",
      "liquor_hue_hex",
      "liquor_hue_name",
      "liquor_clarity",
      "liquor_body",
      "wet_leaf_aroma",
      "wet_leaf_oxidation",
      "sweetness",
      "earthy",
      "aroma_tags",
      "leaf_dose_grams",
      "water_ml",
      "steep_count",
      "steep_instructions",
      "elevation_feet",
      "elevation_display",
      "lot_number",
      "cultivar",
      "estate_story",
    ];

    for (const col of expectedCols) {
      expect(cols).toContain(col);
    }
  });

  it("adds packaging_format and servings columns to variants table", () => {
    const db = new Database(TEST_DB, { readonly: true });
    const cols = db.prepare("PRAGMA table_info(variants)").all().map((c) => (c as { name: string }).name);
    db.close();

    expect(cols).toContain("packaging_format");
    expect(cols).toContain("servings");
  });

  it("re-running migration 009 up(db) is 100% idempotent and does not throw", async () => {
    const db = new Database(TEST_DB);
    const mod = await import(
      path.resolve(process.cwd(), "scripts/migrations/009_teabox_pdp_variants_cupping.mjs")
    );
    expect(() => mod.up(db)).not.toThrow();
    db.close();
  });

  it("normalizes pre-existing variants with default 50 servings when grams <> 100", async () => {
    const memDb = new Database(":memory:");
    memDb.exec(`
      CREATE TABLE variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        sku TEXT UNIQUE,
        grams INTEGER NOT NULL,
        price_paise INTEGER NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO variants (product_id, sku, grams, price_paise, stock) VALUES
        (1, 'LEGACY-50', 50, 50000, 10),
        (1, 'LEGACY-100', 100, 90000, 10),
        (1, 'LEGACY-500', 500, 400000, 10),
        (1, 'LEGACY-1000', 1000, 750000, 10);
    `);

    // Add columns with defaults like migration 009 step 1
    memDb.exec("ALTER TABLE variants ADD COLUMN packaging_format TEXT NOT NULL DEFAULT 'loose_leaf_pouch';");
    memDb.exec("ALTER TABLE variants ADD COLUMN servings INTEGER NOT NULL DEFAULT 50;");

    // Execute normalization query
    memDb.exec(`UPDATE variants SET servings = CASE
      WHEN grams >= 1000 THEN 500
      WHEN grams >= 500 THEN 250
      WHEN grams >= 300 THEN 150
      WHEN grams >= 250 THEN 125
      WHEN grams >= 100 THEN 50
      WHEN grams >= 50 THEN 25
      ELSE MAX(1, CAST(grams / 2 AS INTEGER))
    END WHERE servings IS NULL OR servings = 0 OR (servings = 50 AND grams <> 100);`);

    const rows = memDb.prepare("SELECT sku, servings FROM variants").all() as Array<{ sku: string; servings: number }>;
    const bySku = Object.fromEntries(rows.map((r) => [r.sku, r.servings]));

    expect(bySku["LEGACY-50"]).toBe(25);
    expect(bySku["LEGACY-100"]).toBe(50);
    expect(bySku["LEGACY-500"]).toBe(250);
    expect(bySku["LEGACY-1000"]).toBe(500);

    memDb.close();
  });
});

describe("Suite 2: Variant Data Model & Multi-Dimensional Formats", () => {
  it("validates allowed packaging formats via packagingFormatSchema", () => {
    expect(packagingFormatSchema.safeParse("loose_leaf_pouch").success).toBe(true);
    expect(packagingFormatSchema.safeParse("luxury_tin").success).toBe(true);
    expect(packagingFormatSchema.safeParse("pyramid_bags").success).toBe(true);
    expect(packagingFormatSchema.safeParse("plastic_bottle").success).toBe(false);
    expect(packagingFormatSchema.safeParse("").success).toBe(false);
  });

  it("defaults packaging_format to loose_leaf_pouch and servings to 50 when omitted in variantSchema", () => {
    const parsed = variantSchema.safeParse({
      product_id: 1,
      sku: "TEST-T-100",
      grams: 100,
      price_paise: 50000,
      stock: 10,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.packaging_format).toBe("loose_leaf_pouch");
      expect(parsed.data.servings).toBe(50);
    }
  });

  it("rejects negative stock, negative price, and invalid SKU in variantSchema", () => {
    expect(
      variantSchema.safeParse({
        product_id: 1,
        sku: "TEST-T-100",
        grams: 100,
        price_paise: -100,
        stock: 5,
      }).success
    ).toBe(false);

    expect(
      variantSchema.safeParse({
        product_id: 1,
        sku: "TEST-T-100",
        grams: 100,
        price_paise: 1000,
        stock: -1,
      }).success
    ).toBe(false);

    expect(
      variantSchema.safeParse({
        product_id: 1,
        sku: "lowercase-sku",
        grams: 100,
        price_paise: 1000,
        stock: 5,
      }).success
    ).toBe(false);
  });

  it("persists multi-format variants for a product and retrieves them in order", () => {
    const prod = upsertProduct({
      slug: "risheehat-summer-chinary",
      name: "Darjeeling Risheehat Summer Chinary",
      category: "Black",
      origin: "Darjeeling, India",
      estate: "Risheehat Tea Estate (Illustrative demo source — unverified lot)",
      flush: "Second Flush (Summer)",
      harvest_date: "June 2026 (Demo harvest)",
      description: "Exceptional muscatel summer harvest.",
      tasting_notes: "Muscatel, Peach, Honey",
      floral: 4,
      fruity: 5,
      malty: 2,
      body: 3,
      sweetness: 4,
      earthy: 1,
      aroma_tags: ["Muscatel", "White Peach", "Wild Honey"],
      brew_temp: 95,
      brew_seconds: 180,
      leaf_dose_grams: 2.5,
      water_ml: 200,
      steep_count: 3,
      liquor_hue_hex: "#c87533",
      liquor_hue_name: "Radiant Amber",
      elevation_feet: 5500,
      elevation_display: "4,800 – 6,200 ft",
      lot_number: "EX-12/26",
      cultivar: "Pure Chinary",
      estate_story: "Established in 1858 in Darjeeling eastern valley.",
      featured: 1,
    });

    upsertVariant({
      product_id: prod.id,
      sku: "RSH-POUCH-100",
      packaging_format: "loose_leaf_pouch",
      grams: 100,
      servings: 50,
      price_paise: 95000,
      stock: 25,
    });

    upsertVariant({
      product_id: prod.id,
      sku: "RSH-TIN-100",
      packaging_format: "luxury_tin",
      grams: 100,
      servings: 50,
      price_paise: 115000,
      stock: 15,
    });

    upsertVariant({
      product_id: prod.id,
      sku: "RSH-BAGS-50",
      packaging_format: "pyramid_bags",
      grams: 50,
      servings: 25,
      price_paise: 85000,
      stock: 0, // Sold out state
    });

    const tea = getProductBySlug("risheehat-summer-chinary");
    expect(tea).not.toBeNull();
    expect(tea?.variants.length).toBeGreaterThanOrEqual(3);

    const formats = tea?.variants.map((v) => v.packaging_format);
    expect(formats).toContain("loose_leaf_pouch");
    expect(formats).toContain("luxury_tin");
    expect(formats).toContain("pyramid_bags");

    const soldOutVariant = tea?.variants.find((v) => v.sku === "RSH-BAGS-50");
    expect(soldOutVariant?.stock).toBe(0);
    expect(soldOutVariant?.servings).toBe(25);
  });
});

describe("Suite 3: 3-Stage Cupping & 6-Axis Sensory Profile", () => {
  it("enforces flavor scores between 0 and 5", () => {
    const base = {
      slug: "bad-score",
      name: "Bad Score Tea",
      origin: "Origin",
      estate: "Estate",
      flush: "Spring",
      harvest_date: "2026",
      description: "Description",
      tasting_notes: "Notes",
      brew_temp: 90,
      brew_seconds: 180,
    };

    expect(productSchema.safeParse({ ...base, sweetness: 6 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, earthy: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, floral: 5, sweetness: 4, earthy: 0 }).success).toBe(true);
  });

  it("validates liquor_hue_hex format", () => {
    const base = {
      slug: "hex-check",
      name: "Hex Check Tea",
      origin: "Origin",
      estate: "Estate",
      flush: "Spring",
      harvest_date: "2026",
      description: "Description",
      tasting_notes: "Notes",
      brew_temp: 90,
      brew_seconds: 180,
    };

    expect(productSchema.safeParse({ ...base, liquor_hue_hex: "#c87533" }).success).toBe(true);
    expect(productSchema.safeParse({ ...base, liquor_hue_hex: "#ABC" }).success).toBe(true);
    expect(productSchema.safeParse({ ...base, liquor_hue_hex: "blue" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, liquor_hue_hex: "123456" }).success).toBe(false);
  });

  it("retrieves full 3-stage cupping profile with exact persisted attributes", () => {
    const tea = getProductBySlug("risheehat-summer-chinary");
    expect(tea?.floral).toBe(4);
    expect(tea?.fruity).toBe(5);
    expect(tea?.sweetness).toBe(4);
    expect(tea?.earthy).toBe(1);
    expect(tea?.liquor_hue_hex).toBe("#c87533");
    expect(tea?.liquor_hue_name).toBe("Radiant Amber");
    expect(tea?.lot_number).toBe("EX-12/26");
    expect(tea?.cultivar).toBe("Pure Chinary");
  });
});

describe("Suite 4: Aroma Tags JSON Deserialization", () => {
  it("parses valid JSON array strings into string arrays", () => {
    expect(parseAromaTags('["Muscatel", "Peach", "Honey"]')).toEqual([
      "Muscatel",
      "Peach",
      "Honey",
    ]);
  });

  it("returns an empty array for empty inputs or invalid types", () => {
    expect(parseAromaTags("")).toEqual([]);
    expect(parseAromaTags("   ")).toEqual([]);
    expect(parseAromaTags("[]")).toEqual([]);
    expect(parseAromaTags(null)).toEqual([]);
    expect(parseAromaTags(undefined)).toEqual([]);
    expect(parseAromaTags(12345)).toEqual([]);
  });

  it("falls back to comma-separated string splitting when JSON is non-array or malformed", () => {
    expect(parseAromaTags("Muscatel, White Peach, Wild Honey")).toEqual([
      "Muscatel",
      "White Peach",
      "Wild Honey",
    ]);
  });

  it("filters out empty or non-string items safely", () => {
    expect(parseAromaTags(["Valid", "", "   ", "Tag"])).toEqual(["Valid", "Tag"]);
  });
});

describe("Suite 5: Steeping Parameters & Estate Terroir Dossier", () => {
  it("retrieves steeping guide dose, water volume, and resteeping counts", () => {
    const tea = getProductBySlug("risheehat-summer-chinary");
    expect(tea?.leaf_dose_grams).toBe(2.5);
    expect(tea?.water_ml).toBe(200);
    expect(tea?.steep_count).toBe(3);
    expect(tea?.brew_temp).toBe(95);
    expect(tea?.brew_seconds).toBe(180);
  });

  it("retrieves elevation display, lot number, cultivar, and estate story", () => {
    const tea = getProductBySlug("risheehat-summer-chinary");
    expect(tea?.elevation_feet).toBe(5500);
    expect(tea?.elevation_display).toBe("4,800 – 6,200 ft");
    expect(tea?.cultivar).toBe("Pure Chinary");
    expect(tea?.estate_story).toContain("Established in 1858");
  });
});

describe("Suite 6: Backward Compatibility & Defensive Hydration Fallback", () => {
  it("upserts and retrieves a legacy product that omitted all 009 fields", () => {
    upsertProduct({
      slug: "legacy-tea",
      name: "Legacy Black Tea",
      category: "Black",
      origin: "Assam",
      estate: "Legacy Estate",
      flush: "Summer",
      harvest_date: "2025",
      description: "Simple legacy tea.",
      tasting_notes: "Strong",
      floral: 1,
      fruity: 1,
      malty: 4,
      body: 4,
      brew_temp: 95,
      brew_seconds: 240,
      featured: 0,
    });

    const tea = getProductBySlug("legacy-tea");
    expect(tea).not.toBeNull();
    expect(tea?.sweetness).toBe(0);
    expect(tea?.earthy).toBe(0);
    expect(tea?.aroma_tags).toEqual([]);
    expect(tea?.liquor_hue_hex).toBe("#b36b3d");
    expect(tea?.leaf_dose_grams).toBe(2.5);
    expect(tea?.water_ml).toBe(200);
    expect(tea?.steep_count).toBe(3);
    expect(tea?.elevation_feet).toBe(0);
  });

  it("mapProductRow handles raw rows missing 009 columns without throwing", () => {
    const mockRow: Parameters<typeof mapProductRow>[0] = {
      id: 99,
      slug: "unmigrated-mock",
      name: "Unmigrated Mock Tea",
      category: "Green",
      category_id: null,
      origin: "Kangra",
      estate: "Mock Estate",
      flush: "Spring",
      harvest_date: "2026",
      description: "Mock desc",
      tasting_notes: "Grassy",
      floral: 2,
      fruity: 0,
      malty: 0,
      body: 1,
      brew_temp: 80,
      brew_seconds: 120,
      featured: 0,
    };

    const mapped = mapProductRow(mockRow, []);
    expect(mapped.slug).toBe("unmigrated-mock");
    expect(mapped.sweetness).toBe(0);
    expect(mapped.earthy).toBe(0);
    expect(mapped.aroma_tags).toEqual([]);
    expect(mapped.liquor_hue_hex).toBe("#b36b3d");
    expect(mapped.leaf_dose_grams).toBe(2.5);
  });

  it("mapVariantRow handles raw rows missing 009 columns without throwing", () => {
    const mockVariant: Parameters<typeof mapVariantRow>[0] = {
      id: 88,
      product_id: 99,
      sku: "UNMIGRATED-100",
      grams: 100,
      price_paise: 50000,
      stock: 10,
    };

    const mapped = mapVariantRow(mockVariant);
    expect(mapped.sku).toBe("UNMIGRATED-100");
    expect(mapped.packaging_format).toBe("loose_leaf_pouch");
    expect(mapped.servings).toBe(50);
  });
});

describe("Suite 7: Seed Data Retrieval & Catalog Verification", () => {
  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/seed.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });
  });

  it("seeds all 11 tea products into the database", () => {
    const products = listProducts();
    expect(products.length).toBeGreaterThanOrEqual(11);

    const expectedSlugs = [
      "darjeeling-spring",
      "summer-chinary-black",
      "assam-golden-tips",
      "silver-needles-white",
      "giddapahar-oolong",
      "kangra-green",
      "assam-golden-breakfast",
      "nilgiri-mist-green",
      "himalayan-white-peony",
      "masala-chai-reserve",
      "discovery-flight",
    ];

    const actualSlugs = products.map((p) => p.slug);
    for (const slug of expectedSlugs) {
      expect(actualSlugs).toContain(slug);
    }
  });

  it("verifies every product has 10 variants with deterministic stock states", () => {
    const expectedSlugs = [
      "darjeeling-spring",
      "summer-chinary-black",
      "assam-golden-tips",
      "silver-needles-white",
      "giddapahar-oolong",
      "kangra-green",
      "assam-golden-breakfast",
      "nilgiri-mist-green",
      "himalayan-white-peony",
      "masala-chai-reserve",
      "discovery-flight",
    ];

    for (const slug of expectedSlugs) {
      const prod = getProductBySlug(slug);
      expect(prod).not.toBeNull();
      expect(prod?.variants).toHaveLength(10);

      // Verify deterministic stock states
      const hasSoldOut = prod?.variants.some((v) => v.stock === 0);
      const hasLowStock = prod?.variants.some((v) => v.stock > 0 && v.stock <= 5);
      const hasInStock = prod?.variants.some((v) => v.stock > 5);

      expect(hasSoldOut).toBe(true);
      expect(hasLowStock).toBe(true);
      expect(hasInStock).toBe(true);

      // Verify packaging formats present
      const formats = new Set(prod?.variants.map((v) => v.packaging_format));
      expect(formats.has("loose_leaf_pouch")).toBe(true);
      expect(formats.has("luxury_tin")).toBe(true);
      expect(formats.has("pyramid_bags")).toBe(true);
    }
  });

  it("verifies cupping profiles and aroma tags for seeded teas", () => {
    const djSpring = getProductBySlug("darjeeling-spring");
    expect(djSpring?.aroma_tags).toEqual([
      "Muscatel",
      "Wild Honey",
      "Spring Peach",
      "Alpine Orchid",
      "Dewy Pine",
    ]);
    expect(djSpring?.dry_leaf_grade).toBe("FTGFOP1");
    expect(djSpring?.liquor_hue_hex).toBe("#e29d42");
    expect(djSpring?.brew_temp).toBe(85);
    expect(djSpring?.brew_seconds).toBe(180);
    expect(djSpring?.leaf_dose_grams).toBe(2.5);
    expect(djSpring?.elevation_feet).toBe(5800);
  });
});
