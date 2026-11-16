export type BatchInputs = {
  pricePerKgRupees: number;
  teaUsedGrams: number;
  glassesMade: number;
};

export type BatchResult =
  | { valid: true; costPerGlassRupees: number; costPerGlassPaise: number }
  | { valid: false; reason: "empty" | "non_positive" | "fractional_glasses" };

export function evaluateBatch(input: BatchInputs): BatchResult {
  const { pricePerKgRupees, teaUsedGrams, glassesMade } = input;
  if (
    !Number.isFinite(pricePerKgRupees) ||
    !Number.isFinite(teaUsedGrams) ||
    !Number.isFinite(glassesMade)
  ) {
    return { valid: false, reason: "empty" };
  }
  if (pricePerKgRupees <= 0 || teaUsedGrams <= 0 || glassesMade <= 0) {
    return { valid: false, reason: "non_positive" };
  }
  if (!Number.isInteger(glassesMade)) {
    return { valid: false, reason: "fractional_glasses" };
  }
  // Exact leaf cost: (price/kg * grams / 1000) / glasses
  const costPerGlassRupees = (pricePerKgRupees * teaUsedGrams) / 1000 / glassesMade;
  const costPerGlassPaise = Math.round(costPerGlassRupees * 100);
  return {
    valid: true,
    costPerGlassRupees: Math.round(costPerGlassRupees * 10000) / 10000,
    costPerGlassPaise,
  };
}

export type BatchComparison = {
  batchA: BatchResult;
  batchB: BatchResult;
  differencePaise: number | null;
  direction: "b_cheaper" | "b_costlier" | "parity" | null;
};

export function compareBatches(a: BatchInputs, b: BatchInputs): BatchComparison {
  const resA = evaluateBatch(a);
  const resB = evaluateBatch(b);
  if (!resA.valid || !resB.valid) {
    return { batchA: resA, batchB: resB, differencePaise: null, direction: null };
  }
  const diff = resB.costPerGlassPaise - resA.costPerGlassPaise;
  return {
    batchA: resA,
    batchB: resB,
    differencePaise: Math.abs(diff),
    direction: diff < 0 ? "b_cheaper" : diff > 0 ? "b_costlier" : "parity",
  };
}

export function calculateServingsPerKg(doseGrams = 3): number {
  if (!Number.isFinite(doseGrams) || doseGrams <= 0) return 0;
  return Math.round(1000 / doseGrams);
}

export type PackRecommendation = {
  requiredKg: number;
  requiredGrams: number;
  closestPacks: Array<{
    grams: number;
    labelKg: number;
    coversDays: number;
    differenceGrams: number;
  }>;
};

export function recommendPackCoverage(args: {
  cupsPerDay: number;
  doseGrams: number;
  sellingDays: number;
  availablePackGrams: number[];
}): PackRecommendation {
  const cups = Math.max(0, args.cupsPerDay || 0);
  const dose = Math.max(0, args.doseGrams || 0);
  const days = Math.max(0, args.sellingDays || 0);
  const requiredGrams = Math.round(cups * dose * days);
  const requiredKg = Math.round((requiredGrams / 1000) * 100) / 100;
  const dailyGrams = cups * dose;

  const uniquePacks = Array.from(new Set(args.availablePackGrams.filter((g) => g > 0))).sort(
    (a, b) => a - b
  );
  const closestPacks = uniquePacks
    .map((grams) => ({
      grams,
      labelKg: Math.round((grams / 1000) * 100) / 100,
      coversDays: dailyGrams > 0 ? Math.floor(grams / dailyGrams) : 0,
      differenceGrams: grams - requiredGrams,
    }))
    .sort((a, b) => Math.abs(a.differenceGrams) - Math.abs(b.differenceGrams));

  return { requiredKg, requiredGrams, closestPacks };
}
