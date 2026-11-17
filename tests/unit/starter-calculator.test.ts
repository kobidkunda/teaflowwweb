import { describe, expect, it } from "vitest";
import { calculateStarterNumbers, STARTER_EXAMPLE } from "@/lib/business/starterCalculator";

describe("starter business planning arithmetic", () => {
  it("calculates the disclosed example using integer paise", () => {
    const result = calculateStarterNumbers(STARTER_EXAMPLE);
    expect(result).toMatchObject({ revenue: 3600000, variableCosts: 2400000, contribution: 4000, surplus: 900000, breakEven: 75 });
    expect(result?.margin).toBeCloseTo(100 / 3);
  });
  it("shows losses rather than clamping them to zero", () => {
    expect(calculateStarterNumbers({ ...STARTER_EXAMPLE, selling: 70 })).toMatchObject({ contribution: -1000, surplus: -600000, breakEven: null });
  });
  it("has no break-even with zero contribution, even with no fixed costs", () => {
    expect(calculateStarterNumbers({ ...STARTER_EXAMPLE, selling: 80, fixed: 0 })).toMatchObject({ contribution: 0, surplus: 0, breakEven: null });
  });
  it("rounds break-even upwards and accepts zero fixed expenses", () => {
    expect(calculateStarterNumbers({ ...STARTER_EXAMPLE, fixed: 3001 })?.breakEven).toBe(76);
    expect(calculateStarterNumbers({ ...STARTER_EXAMPLE, fixed: 0 })?.breakEven).toBe(0);
  });
  it("handles no sales, free packs and decimal amounts", () => {
    expect(calculateStarterNumbers({ ...STARTER_EXAMPLE, packs: 0 })).toMatchObject({ revenue: 0, variableCosts: 0, surplus: -300000 });
    expect(calculateStarterNumbers({ ...STARTER_EXAMPLE, selling: 0 })?.margin).toBeNull();
    expect(calculateStarterNumbers({ ...STARTER_EXAMPLE, selling: 120.15, tea: 60.1 })).toMatchObject({ contribution: 4005, revenue: 3604500 });
  });
  it.each([NaN, Infinity, -1, 1_000_001])("rejects invalid costs %s", value => {
    expect(calculateStarterNumbers({ ...STARTER_EXAMPLE, tea: value })).toBeNull();
  });
  it("rejects fractional pack counts and unsafe fixed-cost ranges", () => {
    expect(calculateStarterNumbers({ ...STARTER_EXAMPLE, packs: 1.5 })).toBeNull();
    expect(calculateStarterNumbers({ ...STARTER_EXAMPLE, fixed: 1_000_000_001 })).toBeNull();
  });
});
