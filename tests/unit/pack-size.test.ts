import { describe, expect, it } from "vitest";
import { formatPackWeight } from "../../src/lib/packSize";

describe("storefront pack weight labels", () => {
  it("labels every retail and bulk size using the actual variant grams", () => {
    expect([
      100, 250, 500, 1000, 5000, 10000, 25000, 35000,
    ].map(formatPackWeight)).toEqual([
      "100g", "250g", "500g", "1kg", "5kg", "10kg", "25kg", "35kg",
    ]);
  });

  it("supports fractional kilograms and invalid values", () => {
    expect(formatPackWeight(1500)).toBe("1.5kg");
    expect(formatPackWeight(0)).toBe("—");
    expect(formatPackWeight(Number.NaN)).toBe("—");
  });
});
