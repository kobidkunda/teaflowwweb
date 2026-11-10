import { describe, expect, it } from "vitest";
import { quoteAnalytics } from "@/lib/international/analytics";
import type { Quote } from "@/lib/international/models";
const quote = (changes: Partial<Quote> = {}): Quote => ({
  currency: "INR", subtotalPaise: 200000, discountPaise: 20000, paymentDiscountPaise: 10000, taxPaise: 8095,
  totalMinor: 180000, components: { merchandise: 180000, paymentDiscount: -10000, shipping: 10000, tax: 0, duties: 0, cod: 0 },
  lines: [{ sku: "TEA-A", name: "Tea A", pricePaise: 50000, quantity: 2 }, { sku: "TEA-B", name: "Tea B", pricePaise: 100000, quantity: 1 }],
  analyticsTaxMinor: 8095, ...changes,
} as Quote);
describe("server quote measurement", () => {
  it("excludes included tax, shipping and payment discounts from purchase revenue", () => {
    const result = quoteAnalytics(quote());
    expect(result.value).toBe(1619.05); expect(result.tax).toBe(80.95); expect(result.shipping).toBe(100); expect(result.total).toBe(1800);
    expect(result.items.reduce((sum, line) => sum + line.price * line.quantity, 0)).toBeCloseTo(result.value, 8);
  });
  it("does not subtract exclusive tax twice", () => {
    const result = quoteAnalytics(quote({ components: { merchandise: 180000, paymentDiscount: -10000, shipping: 10000, tax: 8500, duties: 0, cod: 0 }, analyticsTaxMinor: 8500 }));
    expect(result.value).toBe(1700); expect(result.tax).toBe(85);
  });
  it("uses currency minor units including zero and three decimal currencies", () => {
    for (const [currency, digits] of [["JPY", 0], ["KWD", 3]] as const) {
      const result = quoteAnalytics(quote({ currency, components: { merchandise: 10000, shipping: 100, tax: 0, duties: 0, cod: 0 }, analyticsTaxMinor: 500 }));
      expect(result.value).toBe(9500 / 10 ** digits);
      expect(result.items.reduce((sum, l) => sum + l.price * l.quantity, 0)).toBeCloseTo(result.value, 8);
    }
  });
  it("supports older quotes and never serializes addresses", () => {
    const result = quoteAnalytics(quote({ analyticsTaxMinor: undefined, input: { address: { email: "private@example.com", line1: "private street" } } } as Partial<Quote>));
    expect(result.tax).toBe(80.95); expect(JSON.stringify(result)).not.toMatch(/private|address|email/);
  });
});
