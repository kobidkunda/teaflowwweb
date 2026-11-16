export type PackingInput = {
  netGrams: number;
  tareGrams: number;
  boxLengthCm: number;
  boxWidthCm: number;
  boxHeightCm: number;
  dimDivisor: number;
  billingIncrementGrams: number;
  billedWeightRule: "gross" | "max_gross_dim";
  maxNetGrams: number;
  maxBilledGrams: number;
};

export type PackingResult = {
  netGrams: number;
  grossGrams: number;
  dimensionalGrams: number;
  billedGrams: number;
  exceedsNetCapacity: boolean;
  exceedsBilledSlab: boolean;
  exceedsSlab: boolean;
  capacityRatio: number;
};

export function computeParcelPacking(input: PackingInput): PackingResult {
  const netGrams = Math.max(0, Math.round(input.netGrams));
  const tareGrams = Math.max(0, Math.round(input.tareGrams));
  const grossGrams = netGrams + tareGrams;

  const divisor = Math.max(1, input.dimDivisor);
  const volumeCm3 =
    Math.max(1, input.boxLengthCm) *
    Math.max(1, input.boxWidthCm) *
    Math.max(1, input.boxHeightCm);
  const dimensionalGrams = Math.ceil((volumeCm3 / divisor) * 1000);

  const rawBilled =
    input.billedWeightRule === "gross"
      ? grossGrams
      : Math.max(grossGrams, dimensionalGrams);

  const increment = Math.max(1, Math.round(input.billingIncrementGrams));
  const billedGrams = Math.ceil(rawBilled / increment) * increment;

  const maxNetGrams = Math.max(1, Math.round(input.maxNetGrams));
  const maxBilledGrams = Math.max(1, Math.round(input.maxBilledGrams));

  const exceedsNetCapacity = netGrams > maxNetGrams;
  const exceedsBilledSlab = billedGrams > maxBilledGrams;

  return {
    netGrams,
    grossGrams,
    dimensionalGrams,
    billedGrams,
    exceedsNetCapacity,
    exceedsBilledSlab,
    exceedsSlab: exceedsNetCapacity || exceedsBilledSlab,
    capacityRatio: Math.min(2, Math.round((netGrams / maxNetGrams) * 1000) / 1000),
  };
}
