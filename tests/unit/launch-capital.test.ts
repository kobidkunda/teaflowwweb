import { describe, expect, it } from "vitest";
import { calculateLaunchCapital } from "@/lib/business/launchCapital";

describe("startup capital estimates", () => {
  it("keeps missing and unknown costs pending instead of assuming zero", () => {
    expect(calculateLaunchCapital([])).toBeNull();
    expect(calculateLaunchCapital(["1000", ""])).toBeNull();
  });
  it("uses integer paise and supports explicitly confirmed zero costs", () => {
    expect(calculateLaunchCapital(["1000.10", "0", "200.20"])).toBe(120030);
  });
  it("rejects negative, nonfinite, oversized and overprecision inputs", () => {
    for (const amount of ["-1", "Infinity", "NaN", "100000001", "1.001", "1e4", " "]) expect(calculateLaunchCapital([amount])).toBeNull();
  });
});
