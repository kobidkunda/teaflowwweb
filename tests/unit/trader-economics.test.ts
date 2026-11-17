import { describe, expect, it } from "vitest";
import type { Variant } from "@/lib/productModels";
import { calculateTraderScenario, emptyTraderAssumptions, traderUnitPrice, validTraderInput, type TraderAssumptions } from "@/lib/business/traderCalculator";
import { traderPresentationSchema, TRADER_DEFAULTS } from "@/lib/business/traderPresentation";
import oldCopy from "@/lib/business/traderCopy.json";

const variant: Variant = { id: 1, product_id: 1, sku: "TEST-250", grams: 250, packaging_format: "loose_leaf_pouch", servings: 50, price_paise: 10000, compare_at_price_paise: 15000, stock: 60, wholesale_slabs: [{ variant_id: 1, min_qty: 50, price_paise: 9000 }, { variant_id: 1, min_qty: 100, price_paise: 8000 }] };
const input: TraderAssumptions = { inventory: "50", sales: "40", resale: "150", freight: "250", handling: "100", tax: "0", fees: "5", loss: "0", fixed: "500", reserve: "1000", creditDays: "30" };

describe("trade economics with catalogue-backed stock", () => {
  it("uses the matching published quantity tier without inventing discounts", () => {
    expect(traderUnitPrice(variant, 49).unit).toBe(10000);
    expect(traderUnitPrice(variant, 50).unit).toBe(9000);
    expect(traderUnitPrice(variant, 100).unit).toBe(8000);
    expect(traderUnitPrice({ ...variant, wholesale_slabs: [] }, 100).unit).toBe(10000);
  });
  it("keeps unknown freight, tax and other costs pending", () => {
    expect(calculateTraderScenario(variant, emptyTraderAssumptions())).toBeNull();
    expect(calculateTraderScenario(variant, { ...input, freight: "" })).toBeNull();
    expect(calculateTraderScenario(variant, { ...input, tax: "" })).toBeNull();
  });
  it("allocates landed stock cost only to units sold, while funding the whole order", () => {
    const result = calculateTraderScenario(variant, input)!;
    expect(result.purchase).toBe(450000);
    expect(result.landed).toBe(485000);
    expect(result.contribution).toBe(4800);
    expect(result.revenue).toBe(600000);
    expect(result.profit).toBe(142000);
    expect(result.breakEven).toBe(11);
    expect(result.cash).toBe(635000);
  });
  it("handles discounts, zero sales, zero contribution and losses honestly", () => {
    expect(calculateTraderScenario(variant, { ...input, loss: "10" })?.contribution).toBe(3300);
    const noSales = calculateTraderScenario(variant, { ...input, sales: "0" })!;
    expect(noSales.revenue).toBe(0); expect(noSales.margin).toBeNull(); expect(noSales.profit).toBe(-50000);
    const loss = calculateTraderScenario(variant, { ...input, resale: "50" })!;
    expect(loss.profit).toBeLessThan(0); expect(loss.breakEven).toBeNull();
  });
  it("flags MRP, available stock and freight without reserving inventory", () => {
    const result = calculateTraderScenario(variant, { ...input, inventory: "100", resale: "151", freight: "2000" })!;
    expect(result.aboveMrp).toBe(true); expect(result.exceedsStock).toBe(true); expect(result.freightHeavy).toBe(true);
    expect(variant.stock).toBe(60);
  });
  it("rejects impossible monthly sales, invalid precision and unsafe amounts", () => {
    for (const invalid of ["-1", "NaN", "1e3", "0.001", "10000001"]) expect(calculateTraderScenario(variant, { ...input, freight: invalid })).toBeNull();
    expect(calculateTraderScenario(variant, { ...input, sales: "51" })).toBeNull();
    expect(calculateTraderScenario(variant, { ...input, inventory: "0" })).toBeNull();
    expect(validTraderInput("sales", "1.1")).toBe(false);
    expect(validTraderInput("loss", "100.01")).toBe(false);
    expect(validTraderInput("creditDays", "366")).toBe(false);
  });
  it("adds tool defaults to existing presentation documents without losing operator copy", () => {
    const parsed = traderPresentationSchema.parse({ ...TRADER_DEFAULTS, copy: { ...oldCopy, headline: "Operator campaign" } });
    expect(parsed.copy.headline).toBe("Operator campaign");
    expect(parsed.copy.toolsCalculatorTitle).toBe(TRADER_DEFAULTS.copy.toolsCalculatorTitle);
    const { headline: omittedHeadline, ...incompleteCopy } = oldCopy;
    expect(omittedHeadline).toBeTruthy();
    expect(traderPresentationSchema.safeParse({ ...TRADER_DEFAULTS, copy: incompleteCopy }).success).toBe(false);
  });
});
