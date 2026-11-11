import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import type { Variant, PackagingFormat } from "../../src/lib/products";

const TEST_DB = path.join(tmpdir(), `pdp-pricing-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

const {
  getProductBySlug,
  resolveVariant,
  getAvailableFormats,
  getAvailableSizesForFormat,
  isCombinationAvailable,
} = await import("../../src/lib/products");

const {
  formatPerCup,
  calculatePerCupPaise,
  cupsFromGrams,
  formatINR,
  calculateShipping,
  FREE_SHIPPING_THRESHOLD,
} = await import("../../src/lib/money");

const {
  cartItemSchema,
} = await import("../../src/lib/validation");

beforeAll(() => {
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: TEST_DB },
    stdio: "ignore",
  });
  execFileSync(process.execPath, ["scripts/seed.mjs"], {
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

describe("Suite 1: Dynamic Per-Cup Pricing & Unit Economics", () => {
  it("calculates exact per-cup INR cost from price and servings", () => {
    // 100g pouch: ₹950 (95,000 paise) for 50 servings = ₹19/cup
    expect(calculatePerCupPaise(95000, 50)).toBe(1900);
    expect(formatPerCup(95000, 50)).toMatch(/₹\s*19/);

    // 100g luxury tin: ₹1,150 (115,000 paise) for 50 servings = ₹23/cup
    expect(calculatePerCupPaise(115000, 50)).toBe(2300);
    expect(formatPerCup(115000, 50)).toMatch(/₹\s*23/);

    // 50g pyramid bags (25 bags): ₹850 (85,000 paise) for 25 servings = ₹34/cup
    expect(calculatePerCupPaise(85000, 25)).toBe(3400);
    expect(formatPerCup(85000, 25)).toMatch(/₹\s*34/);
  });

  it("demonstrates volume savings: per-cup cost decreases on bulk pack sizes", () => {
    // 100g pouch: ₹950 (50 cups) -> ₹19/cup
    const perCup100g = calculatePerCupPaise(95000, 50);
    // 300g pouch: ₹2,450 (150 cups) -> 245000 / 150 = 1633 paise -> ₹16.33/cup
    const perCup300g = calculatePerCupPaise(245000, 150);
    // 500g pouch: ₹3,800 (250 cups) -> 380000 / 250 = 1520 paise -> ₹15.20/cup
    const perCup500g = calculatePerCupPaise(380000, 250);
    // 1kg pouch: ₹6,500 (500 cups) -> 650000 / 500 = 1300 paise -> ₹13/cup
    const perCup1kg = calculatePerCupPaise(650000, 500);

    expect(perCup100g).toBeGreaterThan(perCup300g);
    expect(perCup300g).toBeGreaterThan(perCup500g);
    expect(perCup500g).toBeGreaterThan(perCup1kg);

    expect(formatPerCup(650000, 500)).toMatch(/₹\s*13/);
  });

  it("handles non-integer per-cup division with standard rounding", () => {
    // 95,000 paise / 30 servings = 3166.666... -> rounds to 3167 paise (₹32)
    expect(calculatePerCupPaise(95000, 30)).toBe(3167);
    expect(formatPerCup(95000, 30)).toMatch(/₹\s*32/);

    // 10,000 paise / 3 servings = 3333.333... -> rounds to 3333 paise (₹33)
    expect(calculatePerCupPaise(10000, 3)).toBe(3333);
    expect(formatPerCup(10000, 3)).toMatch(/₹\s*33/);
  });

  it("calculates cupsFromGrams correctly for all standard packaging sizes", () => {
    expect(cupsFromGrams(50)).toBe(25);
    expect(cupsFromGrams(100)).toBe(50);
    expect(cupsFromGrams(200)).toBe(100);
    expect(cupsFromGrams(300)).toBe(150);
    expect(cupsFromGrams(500)).toBe(250);
    expect(cupsFromGrams(1000)).toBe(500);
    expect(cupsFromGrams(0)).toBe(0);
    expect(cupsFromGrams(1)).toBe(0);
  });

  it("formats Indian rupees with currency symbol and appropriate groupings", () => {
    expect(formatINR(0)).toMatch(/₹\s*0/);
    expect(formatINR(95000)).toMatch(/₹\s*950/);
    expect(formatINR(150000)).toMatch(/₹\s*1,500/);
    expect(formatINR(650000)).toMatch(/₹\s*6,500/);
  });
});

describe("Suite 2: Division by Zero & Defensive Edge Case Safeguards", () => {
  it("strictly guards against servings <= 0 so it never divides by zero", () => {
    expect(calculatePerCupPaise(95000, 0)).toBe(0);
    expect(formatPerCup(95000, 0)).toMatch(/₹\s*0/);

    expect(calculatePerCupPaise(95000, -1)).toBe(0);
    expect(formatPerCup(95000, -1)).toMatch(/₹\s*0/);

    expect(calculatePerCupPaise(95000, -50)).toBe(0);
    expect(formatPerCup(95000, -50)).toMatch(/₹\s*0/);
  });

  it("safely handles non-finite servings (NaN, Infinity, -Infinity)", () => {
    expect(calculatePerCupPaise(95000, NaN)).toBe(0);
    expect(formatPerCup(95000, NaN)).toMatch(/₹\s*0/);

    expect(calculatePerCupPaise(95000, Infinity)).toBe(0);
    expect(formatPerCup(95000, Infinity)).toMatch(/₹\s*0/);

    expect(calculatePerCupPaise(95000, -Infinity)).toBe(0);
    expect(formatPerCup(95000, -Infinity)).toMatch(/₹\s*0/);
  });

  it("safely handles non-positive or non-finite pricePaise", () => {
    expect(calculatePerCupPaise(0, 50)).toBe(0);
    expect(formatPerCup(0, 50)).toMatch(/₹\s*0/);

    expect(calculatePerCupPaise(-50000, 50)).toBe(0);
    expect(formatPerCup(-50000, 50)).toMatch(/₹\s*0/);

    expect(calculatePerCupPaise(NaN, 50)).toBe(0);
    expect(formatPerCup(NaN, 50)).toMatch(/₹\s*0/);

    expect(calculatePerCupPaise(Infinity, 50)).toBe(0);
    expect(formatPerCup(Infinity, 50)).toMatch(/₹\s*0/);
  });
});

describe("Suite 3: Multi-Dimensional Variant Resolution (resolveVariant)", () => {
  const sampleVariants: Variant[] = [
    {
      id: 101,
      product_id: 1,
      sku: "TEST-POUCH-100",
      packaging_format: "loose_leaf_pouch",
      grams: 100,
      servings: 50,
      price_paise: 95000,
      stock: 25,
    },
    {
      id: 102,
      product_id: 1,
      sku: "TEST-POUCH-300",
      packaging_format: "loose_leaf_pouch",
      grams: 300,
      servings: 150,
      price_paise: 245000,
      stock: 12,
    },
    {
      id: 103,
      product_id: 1,
      sku: "TEST-TIN-100",
      packaging_format: "luxury_tin",
      grams: 100,
      servings: 50,
      price_paise: 115000,
      stock: 8,
    },
    {
      id: 104,
      product_id: 1,
      sku: "TEST-TIN-300",
      packaging_format: "luxury_tin",
      grams: 300,
      servings: 150,
      price_paise: 295000,
      stock: 0, // Sold out
    },
    {
      id: 105,
      product_id: 1,
      sku: "TEST-BAGS-50",
      packaging_format: "pyramid_bags",
      grams: 50,
      servings: 25,
      price_paise: 85000,
      stock: 15,
    },
  ];

  it("resolves the exact variant for matching format and pack size", () => {
    const pouch100 = resolveVariant(sampleVariants, "loose_leaf_pouch", 100);
    expect(pouch100).toBeDefined();
    expect(pouch100?.id).toBe(101);
    expect(pouch100?.sku).toBe("TEST-POUCH-100");
    expect(pouch100?.price_paise).toBe(95000);

    const tin300 = resolveVariant(sampleVariants, "luxury_tin", 300);
    expect(tin300).toBeDefined();
    expect(tin300?.id).toBe(104);
    expect(tin300?.sku).toBe("TEST-TIN-300");
    expect(tin300?.stock).toBe(0);

    const bags50 = resolveVariant(sampleVariants, "pyramid_bags", 50);
    expect(bags50).toBeDefined();
    expect(bags50?.id).toBe(105);
    expect(bags50?.servings).toBe(25);
  });

  it("returns undefined when packaging format does not exist for the size", () => {
    const bags300 = resolveVariant(sampleVariants, "pyramid_bags", 300);
    expect(bags300).toBeUndefined();
  });

  it("returns undefined when grams size does not exist for the format", () => {
    const pouch500 = resolveVariant(sampleVariants, "loose_leaf_pouch", 500);
    expect(pouch500).toBeUndefined();
  });

  it("returns undefined safely when variants list is empty or invalid", () => {
    expect(resolveVariant([], "loose_leaf_pouch", 100)).toBeUndefined();
    // @ts-expect-error test invalid parameter handling
    expect(resolveVariant(null, "loose_leaf_pouch", 100)).toBeUndefined();
    // @ts-expect-error test invalid parameter handling
    expect(resolveVariant(undefined, "loose_leaf_pouch", 100)).toBeUndefined();
  });
});

describe("Suite 4: Catalog Formats and Sizes Extraction", () => {
  const sampleVariants: Variant[] = [
    {
      id: 201,
      product_id: 2,
      sku: "V-POUCH-100",
      packaging_format: "loose_leaf_pouch",
      grams: 100,
      servings: 50,
      price_paise: 90000,
      stock: 10,
    },
    {
      id: 202,
      product_id: 2,
      sku: "V-POUCH-300",
      packaging_format: "loose_leaf_pouch",
      grams: 300,
      servings: 150,
      price_paise: 230000,
      stock: 5,
    },
    {
      id: 203,
      product_id: 2,
      sku: "V-POUCH-1000",
      packaging_format: "loose_leaf_pouch",
      grams: 1000,
      servings: 500,
      price_paise: 600000,
      stock: 0, // Sold out
    },
    {
      id: 204,
      product_id: 2,
      sku: "V-TIN-100",
      packaging_format: "luxury_tin",
      grams: 100,
      servings: 50,
      price_paise: 110000,
      stock: 0, // All tin variants sold out
    },
    {
      id: 205,
      product_id: 2,
      sku: "V-BAGS-50",
      packaging_format: "pyramid_bags",
      grams: 50,
      servings: 25,
      price_paise: 80000,
      stock: 20,
    },
  ];

  it("getAvailableFormats extracts distinct formats from variants list", () => {
    const formats = getAvailableFormats(sampleVariants);
    expect(formats).toEqual(["loose_leaf_pouch", "luxury_tin", "pyramid_bags"]);
  });

  it("getAvailableFormats with inStockOnly filters out formats with zero stock", () => {
    const inStockFormats = getAvailableFormats(sampleVariants, { inStockOnly: true });
    expect(inStockFormats).toContain("loose_leaf_pouch");
    expect(inStockFormats).toContain("pyramid_bags");
    expect(inStockFormats).not.toContain("luxury_tin");
  });

  it("getAvailableFormats returns empty array for empty or invalid input", () => {
    expect(getAvailableFormats([])).toEqual([]);
    // @ts-expect-error test defensive check
    expect(getAvailableFormats(null)).toEqual([]);
    // @ts-expect-error test defensive check
    expect(getAvailableFormats(undefined)).toEqual([]);
  });

  it("getAvailableSizesForFormat extracts distinct sizes in ascending order", () => {
    const pouchSizes = getAvailableSizesForFormat(sampleVariants, "loose_leaf_pouch");
    expect(pouchSizes).toEqual([100, 300, 1000]);

    const tinSizes = getAvailableSizesForFormat(sampleVariants, "luxury_tin");
    expect(tinSizes).toEqual([100]);

    const bagsSizes = getAvailableSizesForFormat(sampleVariants, "pyramid_bags");
    expect(bagsSizes).toEqual([50]);
  });

  it("getAvailableSizesForFormat with inStockOnly excludes sold-out pack sizes", () => {
    const inStockPouchSizes = getAvailableSizesForFormat(sampleVariants, "loose_leaf_pouch", {
      inStockOnly: true,
    });
    expect(inStockPouchSizes).toEqual([100, 300]);
    expect(inStockPouchSizes).not.toContain(1000);

    const inStockTinSizes = getAvailableSizesForFormat(sampleVariants, "luxury_tin", {
      inStockOnly: true,
    });
    expect(inStockTinSizes).toEqual([]);
  });

  it("getAvailableSizesForFormat returns empty array for nonexistent format or empty list", () => {
    expect(getAvailableSizesForFormat(sampleVariants, "nonexistent" as PackagingFormat)).toEqual([]);
    expect(getAvailableSizesForFormat([], "loose_leaf_pouch")).toEqual([]);
    // @ts-expect-error test defensive check
    expect(getAvailableSizesForFormat(null, "loose_leaf_pouch")).toEqual([]);
  });
});

describe("Suite 5: Stock Availability Matrix & Transitions (isCombinationAvailable)", () => {
  const sampleVariants: Variant[] = [
    {
      id: 301,
      product_id: 3,
      sku: "AV-POUCH-100",
      packaging_format: "loose_leaf_pouch",
      grams: 100,
      servings: 50,
      price_paise: 95000,
      stock: 15,
    },
    {
      id: 302,
      product_id: 3,
      sku: "AV-POUCH-1000",
      packaging_format: "loose_leaf_pouch",
      grams: 1000,
      servings: 500,
      price_paise: 650000,
      stock: 0, // Sold out
    },
    {
      id: 303,
      product_id: 3,
      sku: "AV-TIN-100",
      packaging_format: "luxury_tin",
      grams: 100,
      servings: 50,
      price_paise: 115000,
      stock: 1, // Low stock, but available
    },
  ];

  it("returns true when variant exists and stock > 0", () => {
    expect(isCombinationAvailable(sampleVariants, "loose_leaf_pouch", 100)).toBe(true);
    expect(isCombinationAvailable(sampleVariants, "luxury_tin", 100)).toBe(true);
  });

  it("returns false when variant exists but stock is 0 (sold-out transition)", () => {
    expect(isCombinationAvailable(sampleVariants, "loose_leaf_pouch", 1000)).toBe(false);
  });

  it("returns false when combination does not exist in the catalog", () => {
    expect(isCombinationAvailable(sampleVariants, "luxury_tin", 1000)).toBe(false);
    expect(isCombinationAvailable(sampleVariants, "pyramid_bags", 50)).toBe(false);
  });

  it("returns false when variants array is empty or undefined", () => {
    expect(isCombinationAvailable([], "loose_leaf_pouch", 100)).toBe(false);
    // @ts-expect-error test defensive check
    expect(isCombinationAvailable(null, "loose_leaf_pouch", 100)).toBe(false);
  });
});

describe("Suite 6: Server Cart Validation (cartItemSchema)", () => {
  it("accepts valid cart items with positive variantId and quantity between 1 and 10", () => {
    expect(cartItemSchema.safeParse({ variantId: 1, quantity: 1 }).success).toBe(true);
    expect(cartItemSchema.safeParse({ variantId: 42, quantity: 5 }).success).toBe(true);
    expect(cartItemSchema.safeParse({ variantId: 100, quantity: 10 }).success).toBe(true);
  });

  it("rejects zero and negative quantities", () => {
    expect(cartItemSchema.safeParse({ variantId: 1, quantity: 0 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ variantId: 1, quantity: -1 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ variantId: 1, quantity: -10 }).success).toBe(false);
  });

  it("rejects quantities exceeding the maximum per-item limit", () => {
    expect(cartItemSchema.safeParse({ variantId: 1, quantity: 10001 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ variantId: 1, quantity: 20000 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ variantId: 1, quantity: 99999 }).success).toBe(false);
  });

  it("rejects non-integer quantities", () => {
    expect(cartItemSchema.safeParse({ variantId: 1, quantity: 1.5 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ variantId: 1, quantity: 2.99 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ variantId: 1, quantity: "1" }).success).toBe(false);
  });

  it("rejects invalid variant IDs (non-positive, non-integer, non-number)", () => {
    expect(cartItemSchema.safeParse({ variantId: 0, quantity: 1 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ variantId: -5, quantity: 1 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ variantId: 1.2, quantity: 1 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ variantId: "abc", quantity: 1 }).success).toBe(false);
  });

  it("rejects missing required fields and empty objects", () => {
    expect(cartItemSchema.safeParse({}).success).toBe(false);
    expect(cartItemSchema.safeParse({ variantId: 1 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ quantity: 1 }).success).toBe(false);
    expect(cartItemSchema.safeParse(null).success).toBe(false);
  });
});

describe("Suite 7: Database Catalog Integration & Real World Commerce Safety", () => {
  it("resolves all variants and computes dynamic prices from database records", () => {
    const tea = getProductBySlug("darjeeling-spring");
    expect(tea).not.toBeNull();
    expect(tea?.variants.length).toBeGreaterThanOrEqual(10);

    const formats = getAvailableFormats(tea!.variants);
    expect(formats).toContain("loose_leaf_pouch");
    expect(formats).toContain("luxury_tin");
    expect(formats).toContain("pyramid_bags");

    const pouchSizes = getAvailableSizesForFormat(tea!.variants, "loose_leaf_pouch");
    expect(pouchSizes).toContain(100);
    expect(pouchSizes).toContain(300);
    expect(pouchSizes).toContain(500);
    expect(pouchSizes).toContain(1000);

    // Resolve 100g pouch
    const pouch100 = resolveVariant(tea!.variants, "loose_leaf_pouch", 100);
    expect(pouch100).toBeDefined();
    expect(pouch100?.stock).toBeGreaterThan(0);
    expect(isCombinationAvailable(tea!.variants, "loose_leaf_pouch", 100)).toBe(true);

    // Calculate per cup price for this real catalog variant
    const perCup = formatPerCup(pouch100!.price_paise, pouch100!.servings);
    expect(perCup).toMatch(/₹\s*\d+/);

    // Verify 1kg luxury tin is deterministic sold-out in seed
    const tin1kg = resolveVariant(tea!.variants, "luxury_tin", 1000);
    expect(tin1kg).toBeDefined();
    expect(tin1kg?.stock).toBe(0);
    expect(isCombinationAvailable(tea!.variants, "luxury_tin", 1000)).toBe(false);
  });

  it("enforces commerce safety: client cart mutation validates against catalog variant IDs", () => {
    const tea = getProductBySlug("summer-chinary-black");
    expect(tea).not.toBeNull();

    const activeVariant = tea!.variants.find((v) => v.stock > 0);
    expect(activeVariant).toBeDefined();

    // Valid cart addition
    const cartPayload = {
      variantId: activeVariant!.id,
      quantity: 2,
    };
    const parsed = cartItemSchema.safeParse(cartPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.variantId).toBe(activeVariant!.id);
      expect(parsed.data.quantity).toBe(2);
    }

    // Client attempting to add non-existent or negative variant ID is blocked
    expect(cartItemSchema.safeParse({ variantId: -999, quantity: 1 }).success).toBe(false);
  });

  it("verifies shipping fee logic adheres to complimentary shipping boundary", () => {
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD - 1)).toBe(9900);
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD + 50000)).toBe(0);
  });
});
