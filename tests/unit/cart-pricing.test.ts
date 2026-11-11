import { describe, expect, it } from "vitest";
import { refreshCartPrices } from "@/lib/cartPricing";

describe("saved cart price reconciliation", () => {
  it("keeps trial identities distinct from product variants and preserves quantities", () => {
    const saved = [
      { variantId: 7, pricePaise: 19900, quantity: 2 },
      { variantId: 0, trialId: "kit", pricePaise: 29900, quantity: 3 },
    ];
    const updated = refreshCartPrices(saved, { "var-7": 10000, "trial-kit": 20000 });
    expect(updated.reduce((sum, line) => sum + line.pricePaise * line.quantity, 0)).toBe(80000);
    expect(updated.map(line => line.quantity)).toEqual([2, 3]);
    expect(saved[0].pricePaise).toBe(19900);
  });
  it("retains saved estimates when no usable catalogue price is returned", () => {
    const saved = [{ variantId: 7, pricePaise: 10000, quantity: 2 }];
    for (const invalid of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(refreshCartPrices(saved, { "var-7": invalid })[0]).toBe(saved[0]);
    }
    expect(refreshCartPrices(saved, {})[0]).toBe(saved[0]);
  });
  it("accepts an authoritative zero price", () => {
    expect(refreshCartPrices([{ variantId: 7, pricePaise: 10000 }], { "var-7": 0 })[0].pricePaise).toBe(0);
  });
});
