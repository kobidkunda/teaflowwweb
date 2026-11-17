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
  fullCoverageSuggestion: {
    packs: Array<{ grams: number; labelKg: number; count: number }>;
    totalGrams: number;
    totalKg: number;
    coversDays: number;
    summaryLabel: string;
  } | null;
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

  // Compute full-period multi-pack combination that meets or exceeds requiredGrams
  let fullCoverageSuggestion: PackRecommendation["fullCoverageSuggestion"] = null;
  if (requiredGrams > 0 && uniquePacks.length > 0) {
    const bulkPacks = uniquePacks.filter((g) => g >= 1000);
    const pool = bulkPacks.length > 0 ? bulkPacks : uniquePacks;
    const desc = [...pool].sort((a, b) => b - a);
    const smallest = desc[desc.length - 1];

    // Check single-pack fit >= requiredGrams first if no overshot is huge
    let bestCombo: Map<number, number> | null = null;
    let bestTotal = Infinity;

    // Greedy + remainder top-up using largest packs then smallest pack covering remainder
    const greedy = new Map<number, number>();
    let rem = requiredGrams;
    for (let i = 0; i < desc.length; i++) {
      const p = desc[i];
      if (p <= rem) {
        const cnt = Math.floor(rem / p);
        if (cnt > 0) {
          greedy.set(p, (greedy.get(p) || 0) + cnt);
          rem -= cnt * p;
        }
      }
    }
    if (rem > 0) {
      const nextPack = [...pool].sort((a, b) => a - b).find((p) => p >= rem) ?? smallest;
      greedy.set(nextPack, (greedy.get(nextPack) || 0) + 1);
    }
    let greedyTotal = 0;
    greedy.forEach((cnt, g) => {
      greedyTotal += cnt * g;
    });
    bestCombo = greedy;
    bestTotal = greedyTotal;

    // Also compare with single smallest pack >= requiredGrams (e.g. 25 kg instead of 2x10 + 5)
    const singleCover = pool.find((p) => p >= requiredGrams);
    if (singleCover && singleCover <= bestTotal) {
      bestCombo = new Map([[singleCover, 1]]);
      bestTotal = singleCover;
    }

    if (bestCombo) {
      const packs = Array.from(bestCombo.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([grams, count]) => ({
          grams,
          labelKg: Math.round((grams / 1000) * 100) / 100,
          count,
        }));
      const summaryLabel = packs
        .map((p) => (p.count > 1 ? `${p.count} × ${p.labelKg} kg` : `${p.labelKg} kg`))
        .join(" + ");
      fullCoverageSuggestion = {
        packs,
        totalGrams: bestTotal,
        totalKg: Math.round((bestTotal / 1000) * 100) / 100,
        coversDays: dailyGrams > 0 ? Math.floor(bestTotal / dailyGrams) : 0,
        summaryLabel,
      };
    }
  }

  return { requiredKg, requiredGrams, closestPacks, fullCoverageSuggestion };
}
