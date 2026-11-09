import { describe, it, expect } from "vitest";
import { calculateShipping, FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "../../src/lib/checkout";
import { cupsFromGrams, formatINR } from "../../src/lib/money";
describe("commerce pricing", () => {
  it("charges shipping below threshold", () => {
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD - 1)).toBe(SHIPPING_FEE);
  });
  it("offers free shipping at threshold", () => {
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD)).toBe(0);
  });
  it("computes illustrative cups", () => {
    expect(cupsFromGrams(100)).toBe(50);
  });
  it("formats Indian rupees", () => {
    expect(formatINR(99900)).toContain("999");
  });
});
