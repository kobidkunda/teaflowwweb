import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
// Isolated temp DB: storefront readers hit DATABASE_PATH lazily via getDb(),
// so the admin-seeded ./data/store.sqlite (WELCOME10 + sliders) never leaks in.
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "storefront-test-")), "test.sqlite");
process.env.DATABASE_PATH = tmp;
const {
  computeCouponDiscount,
  validateCouponServer,
  listActiveSliders,
  listStorefrontCategories,
  getProductImages,
} = await import("../../src/lib/storefront");
const { checkoutSchema } = await import("../../src/lib/validation");

beforeAll(() => {
  // Baseline schema only: no coupons / sliders / product_images / categories
  // tables, so the "absent" describes below exercise the fallback paths.
  const db = new Database(tmp);
  db.exec([
    "CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE,",
    "name TEXT NOT NULL, category TEXT NOT NULL, origin TEXT NOT NULL, estate TEXT NOT NULL,",
    "flush TEXT NOT NULL, harvest_date TEXT NOT NULL, description TEXT NOT NULL, tasting_notes TEXT NOT NULL,",
    "floral INTEGER NOT NULL DEFAULT 0, fruity INTEGER NOT NULL DEFAULT 0, malty INTEGER NOT NULL DEFAULT 0,",
    "body INTEGER NOT NULL DEFAULT 0, brew_temp INTEGER NOT NULL, brew_seconds INTEGER NOT NULL,",
    "featured INTEGER NOT NULL DEFAULT 0);",
    "CREATE TABLE variants (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL,",
    "sku TEXT NOT NULL UNIQUE, grams INTEGER NOT NULL, price_paise INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0);",
    "CREATE TABLE orders (id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL,",
    "customer_email TEXT NOT NULL, shipping_address TEXT NOT NULL, subtotal_paise INTEGER NOT NULL,",
    "shipping_paise INTEGER NOT NULL, total_paise INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'demo_unpaid',",
    "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
    "CREATE TABLE order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL REFERENCES orders(id),",
    "variant_id INTEGER NOT NULL REFERENCES variants(id), quantity INTEGER NOT NULL, unit_price_paise INTEGER NOT NULL);",
    "INSERT INTO products (slug,name,category,origin,estate,flush,harvest_date,description,tasting_notes,brew_temp,brew_seconds,featured)",
    "VALUES ('t-black','Test Black','Black','Nowhere','Demo estate','Spring','Unverified','desc','notes',90,180,1);",
    "INSERT INTO products (slug,name,category,origin,estate,flush,harvest_date,description,tasting_notes,brew_temp,brew_seconds,featured)",
    "VALUES ('t-green','Test Green','Green','Nowhere','Demo estate','Spring','Unverified','desc','notes',80,150,0);",
  ].join("\n"));
  db.close();
});

describe("coupon math (server-side, never client-trusted)", () => {
  it("applies percent coupons capped at 50%", () => {
    expect(computeCouponDiscount("percent", 10, 100000)).toBe(10000);
    expect(computeCouponDiscount("percent", 90, 100000)).toBe(50000);
  });
  it("caps flat coupons at the subtotal", () => {
    expect(computeCouponDiscount("flat", 5000, 3000)).toBe(3000);
    expect(computeCouponDiscount("flat", 5000, 100000)).toBe(5000);
  });
  it("returns zero for non-positive inputs", () => {
    expect(computeCouponDiscount("percent", 10, 0)).toBe(0);
    expect(computeCouponDiscount("flat", 0, 5000)).toBe(0);
  });
});

describe("defensive readers when contract tables are absent", () => {
  it("returns an empty slider list when the sliders table is absent", () => {
    expect(listActiveSliders()).toEqual([]);
  });
  it("falls back to legacy categories when the categories table is absent", () => {
    const cats = listStorefrontCategories();
    expect(cats.map((c) => c.name).sort()).toEqual(["Black", "Green"]);
  });
  it("returns no gallery images when the product_images table is absent", () => {
    expect(getProductImages(1)).toEqual([]);
  });
  it("rejects a coupon gracefully when the coupons table is absent", () => {
    expect(validateCouponServer("WELCOME10", 200000).valid).toBe(false);
  });
});

describe("contract tables once migrated", () => {
  // NOTE: these run after the "absent" block (file order) and create the
  // tables inline — nested beforeAll would run before ALL tests in the file.
  it("validates a seeded coupon once the coupons table exists", () => {
    const db = new Database(tmp);
    db.exec(
      "CREATE TABLE IF NOT EXISTS coupons (code TEXT PRIMARY KEY, kind TEXT NOT NULL, value INTEGER NOT NULL, " +
        "min_subtotal_paise INTEGER NOT NULL DEFAULT 0, max_uses INTEGER, used_count INTEGER NOT NULL DEFAULT 0, " +
        "starts_at TEXT, ends_at TEXT, is_active INTEGER NOT NULL DEFAULT 1, " +
        "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); " +
        "INSERT OR IGNORE INTO coupons (code, kind, value, min_subtotal_paise, is_active) " +
        "VALUES ('WELCOME10','percent',10,0,1);"
    );
    db.close();
    expect(validateCouponServer("WELCOME10", 200000)).toEqual({
      valid: true,
      discountPaise: 20000,
    });
    expect(validateCouponServer("NOPE", 200000).valid).toBe(false);
  });
  it("lists active sliders once the sliders table exists", () => {
    const db = new Database(tmp);
    db.exec(
      "CREATE TABLE IF NOT EXISTS sliders (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, " +
        "subtitle TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL, cta_label TEXT NOT NULL DEFAULT '', " +
        "cta_href TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, " +
        "is_active INTEGER NOT NULL DEFAULT 1, starts_at TEXT, ends_at TEXT, " +
        "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); " +
        "INSERT INTO sliders (title, subtitle, image_url, cta_label, cta_href) " +
        "VALUES ('Spring story','Seasonal','/images/hero-tea.svg','Shop now','/shop');"
    );
    db.close();
    const slides = listActiveSliders();
    expect(slides.length).toBe(1);
    expect(slides[0].title).toBe("Spring story");
  });
});

describe("checkout couponCode field", () => {
  const base = {
    name: "Test Customer",
    email: "test@example.com",
    address: "123 Sample Street, Demo City",
    idempotencyKey: "a5b2c3d4-e5f6-47a8-9b01-123456789abc",
    items: [{ variantId: 1, quantity: 1 }],
  };
  it("is optional", () => {
    expect(checkoutSchema.safeParse(base).success).toBe(true);
  });
  it("accepts and normalizes a code", () => {
    const parsed = checkoutSchema.safeParse({ ...base, couponCode: "save10" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.couponCode).toBe("SAVE10");
  });
  it("rejects malformed codes", () => {
    expect(checkoutSchema.safeParse({ ...base, couponCode: "!!!" }).success).toBe(
      false
    );
  });
});
