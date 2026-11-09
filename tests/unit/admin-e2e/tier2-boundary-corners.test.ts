import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, createMockImageBuffer, type TestEnv } from "./test-helper";
import { POST as productsPOST } from "@/app/api/admin/products/route";
import { POST as categoriesPOST } from "@/app/api/admin/categories/route";
import { POST as couponsPOST } from "@/app/api/admin/coupons/route";
import { POST as orderDispatchPOST } from "@/app/api/admin/orders/[id]/dispatch/route";
import { POST as orderCancelPOST } from "@/app/api/admin/orders/[id]/cancel/route";
import { POST as usersPOST } from "@/app/api/admin/users/route";
import { productSchema, categorySchema, couponSchema, createUserSchema } from "@/lib/validation";
import { setDispatchStatus, OrderTransitionError } from "@/lib/orders";
import { validateImageUpload, detectImageMimeType, UploadValidationError } from "@/lib/uploads";

describe("Tier 2: Boundary & Corner Cases", () => {
  let env: TestEnv;
  let rootCookie: string;

  beforeAll(() => {
    env = setupAdminTestEnv();
    rootCookie = getAuthCookie(env.db, "root");
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("Product Boundaries: Slug lengths, Sensory (0–5), Brew specs", () => {
    it("validates slug boundaries (min 3, max 80) and rejects non-conforming slugs", () => {
      // 2 chars (too short)
      expect(productSchema.shape.slug.safeParse("ab").success).toBe(false);
      // 3 chars (valid minimum)
      expect(productSchema.shape.slug.safeParse("abc").success).toBe(true);
      // 80 chars (valid maximum)
      const maxSlug = "a".repeat(80);
      expect(productSchema.shape.slug.safeParse(maxSlug).success).toBe(true);
      // 81 chars (too long)
      const overSlug = "a".repeat(81);
      expect(productSchema.shape.slug.safeParse(overSlug).success).toBe(false);
      // Disallowed special symbols rejected
      expect(productSchema.shape.slug.safeParse("darjeeling@tea").success).toBe(false);
      expect(productSchema.shape.slug.safeParse("darjeeling tea").success).toBe(false);
      // Uppercase automatically normalized to lowercase
      const parsed = productSchema.shape.slug.parse("Darjeeling-Tea");
      expect(parsed).toBe("darjeeling-tea");
    });

    it("enforces sensory ratings strictly within 0 to 5 range", () => {
      const baseProduct = {
        slug: "sensory-boundary-tea",
        name: "Sensory Boundary Tea",
        origin: "Darjeeling",
        estate: "Risheehat",
        flush: "Summer",
        harvest_date: "2026",
        description: "Testing boundary conditions.",
        tasting_notes: "Floral, honey.",
        brew_temp: 90,
        brew_seconds: 180,
      };

      // Valid boundary values (0 and 5)
      expect(productSchema.safeParse({ ...baseProduct, floral: 0, fruity: 5, malty: 0, body: 5 }).success).toBe(true);

      // Negative value (-1) rejected
      expect(productSchema.safeParse({ ...baseProduct, floral: -1 }).success).toBe(false);

      // Above maximum (6) rejected
      expect(productSchema.safeParse({ ...baseProduct, fruity: 6 }).success).toBe(false);
    });

    it("enforces brew temperature between 50°C and 100°C", () => {
      const baseProduct = {
        slug: "brew-temp-tea",
        name: "Brew Temp Tea",
        origin: "Darjeeling",
        estate: "Risheehat",
        flush: "Summer",
        harvest_date: "2026",
        description: "Testing brew temp.",
        tasting_notes: "Honey.",
        brew_seconds: 180,
      };

      // Boundary values
      expect(productSchema.safeParse({ ...baseProduct, brew_temp: 50 }).success).toBe(true);
      expect(productSchema.safeParse({ ...baseProduct, brew_temp: 100 }).success).toBe(true);

      // Out of bounds
      expect(productSchema.safeParse({ ...baseProduct, brew_temp: 49 }).success).toBe(false);
      expect(productSchema.safeParse({ ...baseProduct, brew_temp: 101 }).success).toBe(false);
    });

    it("enforces brew seconds between 30 and 600 seconds", () => {
      const baseProduct = {
        slug: "brew-sec-tea",
        name: "Brew Seconds Tea",
        origin: "Darjeeling",
        estate: "Risheehat",
        flush: "Summer",
        harvest_date: "2026",
        description: "Testing brew seconds.",
        tasting_notes: "Honey.",
        brew_temp: 90,
      };

      // Boundary values
      expect(productSchema.safeParse({ ...baseProduct, brew_seconds: 30 }).success).toBe(true);
      expect(productSchema.safeParse({ ...baseProduct, brew_seconds: 600 }).success).toBe(true);

      // Out of bounds
      expect(productSchema.safeParse({ ...baseProduct, brew_seconds: 29 }).success).toBe(false);
      expect(productSchema.safeParse({ ...baseProduct, brew_seconds: 601 }).success).toBe(false);
    });

    it("safely handles multi-byte Unicode and rich storytelling characters in descriptions and tasting notes", async () => {
      const unicodeProduct = {
        slug: "unicode-himalayan-delight",
        name: "Himalayan Reserve — ॠषीहाट (Risheehat) 🏔️",
        origin: "Darjeeling 27°02′N 88°16′E",
        estate: "Risheehat Estate (Elevation: 1,800m)",
        flush: "Autumnal Flush / शरत्कालीन",
        harvest_date: "October 2026",
        description: "Special reserve curated at 6,000 feet with notes of ‘wild honey’, roasted hazelnuts & orchids. Tested with quotes: \"premium\" & em-dashes — perfectly preserved.",
        tasting_notes: "Muscatel • Honey • Cedarwood • Orchid (ఆర్కిడ్)",
        brew_temp: 95,
        brew_seconds: 240,
      };

      const req = new Request("http://localhost/api/admin/products", {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify(unicodeProduct),
      });

      const res = await productsPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.slug).toBe("unicode-himalayan-delight");

      const saved = env.db.prepare("SELECT * FROM products WHERE slug = ?").get("unicode-himalayan-delight") as any;
      expect(saved.name).toContain("ॠषीहाट");
      expect(saved.description).toContain("‘wild honey’");
    });
  });

  describe("Category Boundaries: Slugs, Regex, Sort Order", () => {
    it("validates category slug regex strictly: lowercase letters, numbers, hyphens only", () => {
      expect(categorySchema.safeParse({ slug: "green-tea", name: "Green Tea" }).success).toBe(true);
      expect(categorySchema.safeParse({ slug: "green_tea", name: "Green Tea" }).success).toBe(false); // underscore disallowed
      expect(categorySchema.safeParse({ slug: "green tea", name: "Green Tea" }).success).toBe(false); // spaces disallowed
      expect(categorySchema.safeParse({ slug: "green@tea", name: "Green Tea" }).success).toBe(false); // special char disallowed
      // Uppercase automatically normalized
      expect(categorySchema.parse({ slug: "GreenTea", name: "Green Tea" }).slug).toBe("greentea");
    });

    it("enforces category name length (2 to 60 characters)", () => {
      expect(categorySchema.safeParse({ slug: "valid-cat-1", name: "A" }).success).toBe(false); // too short
      expect(categorySchema.safeParse({ slug: "valid-cat-2", name: "AB" }).success).toBe(true); // min 2
      expect(categorySchema.safeParse({ slug: "valid-cat-3", name: "A".repeat(60) }).success).toBe(true); // max 60
      expect(categorySchema.safeParse({ slug: "valid-cat-4", name: "A".repeat(61) }).success).toBe(false); // too long
    });
  });

  describe("Coupon Limits: 1–50% Boundary & Negative Tests", () => {
    it("accepts percent coupons at boundaries 1% and 50%", () => {
      expect(couponSchema.safeParse({ code: "MIN01", kind: "percent", value: 1 }).success).toBe(true);
      expect(couponSchema.safeParse({ code: "MAX50", kind: "percent", value: 50 }).success).toBe(true);
    });

    it("rejects percent coupons at 0% and 51% with validation errors", () => {
      expect(couponSchema.safeParse({ code: "ZERO00", kind: "percent", value: 0 }).success).toBe(false);
      expect(couponSchema.safeParse({ code: "OVER51", kind: "percent", value: 51 }).success).toBe(false);
      expect(couponSchema.safeParse({ code: "OVER99", kind: "percent", value: 99 }).success).toBe(false);
    });

    it("enforces flat coupons value must be positive integer paise", () => {
      expect(couponSchema.safeParse({ code: "FLAT01", kind: "flat", value: 1 }).success).toBe(true);
      expect(couponSchema.safeParse({ code: "FLAT00", kind: "flat", value: 0 }).success).toBe(false);
      expect(couponSchema.safeParse({ code: "FLATNEG", kind: "flat", value: -100 }).success).toBe(false);
    });
  });

  describe("Order State Machine Boundary & Illegal State Jumps", () => {
    const boundaryOrder = "ord-boundary-states-99";

    beforeAll(() => {
      env.db.exec(`
        INSERT OR REPLACE INTO orders (
          id, idempotency_key, customer_name, customer_email, shipping_address,
          subtotal_paise, shipping_paise, total_paise, payment_status, dispatch_status
        ) VALUES ('${boundaryOrder}', 'idem-boundary-1', 'Test Customer', 'cust@tea.com', 'Darjeeling', 100000, 9900, 109900, 'unpaid', 'unfulfilled');
      `);
    });

    it("rejects illegal skip from unfulfilled directly to delivered (HTTP 409)", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${boundaryOrder}/dispatch`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "delivered" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: boundaryOrder }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/not allowed/i);
    });

    it("rejects illegal skip from unfulfilled directly to shipped (HTTP 409)", async () => {
      const req = new Request(`http://localhost/api/admin/orders/${boundaryOrder}/dispatch`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "shipped" }),
      });

      const res = await orderDispatchPOST(req, { params: Promise.resolve({ id: boundaryOrder }) });
      expect(res.status).toBe(409);
    });

    it("rejects cancelling an order that is already delivered", () => {
      const deliveredOrderId = "ord-boundary-delivered";
      env.db.exec(`
        INSERT OR REPLACE INTO orders (
          id, idempotency_key, customer_name, customer_email, shipping_address,
          subtotal_paise, shipping_paise, total_paise, payment_status, dispatch_status
        ) VALUES ('${deliveredOrderId}', 'idem-deliv-1', 'Delivered Cust', 'deliv@tea.com', 'Delhi', 100000, 0, 100000, 'paid', 'delivered');
      `);

      expect(() => setDispatchStatus(deliveredOrderId, "cancelled")).toThrow(OrderTransitionError);
    });
  });

  describe("Staff Accounts & Authentication Boundary Conditions", () => {
    it("enforces staff password minimum length of 12 characters", () => {
      // 11 chars rejected
      expect(createUserSchema.safeParse({ username: "staff_test1", password: "12345678901", role: "admin" }).success).toBe(false);
      // 12 chars accepted
      expect(createUserSchema.safeParse({ username: "staff_test2", password: "123456789012", role: "admin" }).success).toBe(true);
      // 200 chars accepted
      expect(createUserSchema.safeParse({ username: "staff_test3", password: "a".repeat(200), role: "admin" }).success).toBe(true);
      // 201 chars rejected
      expect(createUserSchema.safeParse({ username: "staff_test4", password: "a".repeat(201), role: "admin" }).success).toBe(false);
    });

    it("enforces username character and length restrictions", () => {
      // Min 3 chars
      expect(createUserSchema.safeParse({ username: "ab", password: "validpassword123", role: "admin" }).success).toBe(false);
      expect(createUserSchema.safeParse({ username: "abc", password: "validpassword123", role: "admin" }).success).toBe(true);
      // Max 32 chars
      expect(createUserSchema.safeParse({ username: "a".repeat(32), password: "validpassword123", role: "admin" }).success).toBe(true);
      expect(createUserSchema.safeParse({ username: "a".repeat(33), password: "validpassword123", role: "admin" }).success).toBe(false);
      // Disallows spaces and special characters
      expect(createUserSchema.safeParse({ username: "admin user", password: "validpassword123", role: "admin" }).success).toBe(false);
      expect(createUserSchema.safeParse({ username: "admin@user", password: "validpassword123", role: "admin" }).success).toBe(false);
      // Uppercase automatically normalized
      expect(createUserSchema.parse({ username: "AdminUser", password: "validpassword123", role: "admin" }).username).toBe("adminuser");
    });

    it("rejects invalid non-UUID idempotency keys with HTTP 400", async () => {
      const payload = {
        slug: "invalid-uuid-tea",
        name: "Invalid UUID Tea",
        origin: "Darjeeling",
        estate: "Risheehat",
        flush: "Summer",
        harvest_date: "2026",
        description: "Test.",
        tasting_notes: "Honey.",
        brew_temp: 90,
        brew_seconds: 180,
        idempotencyKey: "not-a-valid-uuid-1234",
      };

      const req = new Request("http://localhost/api/admin/products", {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await productsPOST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("Media Size Limit & Magic Byte Boundary Validation", () => {
    it("verifies 5MB file size limit boundary (5,242,880 bytes)", () => {
      const EXACT_5MB = 5 * 1024 * 1024; // 5,242,880
      const OVER_5MB = EXACT_5MB + 1;

      // Valid JPEG header buffer of exactly 5MB
      const validBuf = Buffer.alloc(EXACT_5MB);
      validBuf[0] = 0xff;
      validBuf[1] = 0xd8;
      validBuf[2] = 0xff;

      const res = validateImageUpload(validBuf);
      expect(res.mimeType).toBe("image/jpeg");

      // Over 5MB buffer
      const overBuf = Buffer.alloc(OVER_5MB);
      overBuf[0] = 0xff;
      overBuf[1] = 0xd8;
      overBuf[2] = 0xff;

      expect(() => validateImageUpload(overBuf)).toThrow(UploadValidationError);
      try {
        validateImageUpload(overBuf);
      } catch (err: unknown) {
        expect((err as UploadValidationError).statusCode).toBe(413);
      }
    });

    it("verifies disguised executable files with fake image extensions are rejected", () => {
      // Buffer starting with Windows MZ header
      const fakeJpg = createMockImageBuffer("exe");

      expect(detectImageMimeType(fakeJpg)).toBeNull();
      expect(() =>
        validateImageUpload(fakeJpg, { originalFilename: "photo.jpg", declaredMimeType: "image/jpeg" })
      ).toThrow(UploadValidationError);
    });
  });

  describe("Variant, Slider & Promotion Boundaries", () => {
    it("enforces variant weights must be strictly positive integers (grams > 0)", async () => {
      const { variantSchema } = await import("@/lib/validation");
      expect(variantSchema.safeParse({ product_id: 1, sku: "RISH-0G", grams: 0, price_paise: 100, stock: 10 }).success).toBe(false);
      expect(variantSchema.safeParse({ product_id: 1, sku: "RISH-NEG", grams: -50, price_paise: 100, stock: 10 }).success).toBe(false);
      expect(variantSchema.safeParse({ product_id: 1, sku: "RISH-POS", grams: 100, price_paise: 100, stock: 10 }).success).toBe(true);
    });

    it("enforces variant price and stock cannot be negative", async () => {
      const { variantSchema } = await import("@/lib/validation");
      expect(variantSchema.safeParse({ product_id: 1, sku: "RISH-1", grams: 100, price_paise: -1, stock: 10 }).success).toBe(false);
      expect(variantSchema.safeParse({ product_id: 1, sku: "RISH-2", grams: 100, price_paise: 100, stock: -5 }).success).toBe(false);
      expect(variantSchema.safeParse({ product_id: 1, sku: "RISH-3", grams: 100, price_paise: 0, stock: 0 }).success).toBe(true); // 0 paise or 0 stock valid
    });

    it("enforces hero slider title boundaries (2 to 80 chars) and validates cta_href protocol", async () => {
      const { sliderSchema } = await import("@/lib/validation");
      expect(sliderSchema.safeParse({ title: "A", image_url: "/uploads/hero.webp" }).success).toBe(false); // too short
      expect(sliderSchema.safeParse({ title: "A".repeat(81), image_url: "/uploads/hero.webp" }).success).toBe(false); // too long
      expect(sliderSchema.safeParse({ title: "Autumn Harvest", image_url: "/uploads/hero.webp", cta_href: "javascript:alert(1)" }).success).toBe(false); // XSS protocol disallowed
      expect(sliderSchema.safeParse({ title: "Autumn Harvest", image_url: "/uploads/hero.webp", cta_href: "/tea/darjeeling" }).success).toBe(true); // site-relative allowed
    });

    it("validates coupon ISO date boundaries and rejects non-ISO strings", async () => {
      const { couponSchema } = await import("@/lib/validation");
      expect(couponSchema.safeParse({ code: "DATE01", kind: "percent", value: 10, starts_at: "invalid-date" }).success).toBe(false);
      expect(couponSchema.safeParse({ code: "DATE02", kind: "percent", value: 10, starts_at: "2026-10-10T12:00:00Z" }).success).toBe(true);
    });
  });
});
