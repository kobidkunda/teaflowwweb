import { describe, it, expect } from "vitest";
import { checkoutSchema } from "../../src/lib/validation";
const valid = {
  name: "Test Customer", email: "test@example.com",
  address: "123 Sample Street, Demo City",
  idempotencyKey: "a5b2c3d4-e5f6-47a8-9b01-123456789abc",
  items: [{ variantId: 1, quantity: 2 }]
};
describe("checkout validation", () => {
  it("accepts valid demo data", () => {
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects empty cart", () => {
    expect(checkoutSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
  });
  it("rejects invalid quantities", () => {
    expect(checkoutSchema.safeParse({ ...valid, items: [{ variantId: 1, quantity: -1 }] }).success).toBe(false);
  });
  it("rejects invalid email", () => {
    expect(checkoutSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });
});

describe("product validation & normalization", () => {
  it("normalizes minimal product input with default connoisseur fields and derives slug", async () => {
    const { normalizeProductInput, productSchema } = await import("../../src/lib/validation");
    const minimal = { name: "Darjeeling Reserve", price: 199 };
    const normalized = normalizeProductInput(minimal);
    expect(normalized.slug).toBe("darjeeling-reserve");
    expect(normalized.price).toBe(199);
    expect(normalized.price_paise).toBe(19900);
    expect(normalized.origin).toBeDefined();
    expect(normalized.brew_temp).toBe(90);

    const parsed = productSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
  });

  it("accepts direct price, price_paise, and price_inr in productSchema", async () => {
    const { normalizeProductInput, productSchema } = await import("../../src/lib/validation");
    const raw = normalizeProductInput({
      name: "Assam Morning",
      price_paise: 19900,
    });
    const parsed = productSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.price_paise).toBe(19900);
      expect(parsed.data.price).toBe(199);
    }
  });

  it("rejects negative price values", async () => {
    const { normalizeProductInput, productSchema } = await import("../../src/lib/validation");
    const raw = normalizeProductInput({
      name: "Negative Price Tea",
      price: -50,
    });
    const parsed = productSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });
});
