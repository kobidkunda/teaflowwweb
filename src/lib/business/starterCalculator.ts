export type StarterNumbers = {
  selling: number;
  tea: number;
  packaging: number;
  freight: number;
  fees: number;
  packs: number;
  fixed: number;
};

export const STARTER_EXAMPLE: StarterNumbers = {
  selling: 120, tea: 60, packaging: 10, freight: 5, fees: 5, packs: 300, fixed: 3000,
};

/** Inputs are rupees; calculations use integer paise. This is never an order quote. */
export function calculateStarterNumbers(input: StarterNumbers) {
  if (Object.entries(input).some(([key, value]) =>
    !Number.isFinite(value) || value < 0 || value > (key === "fixed" ? 1_000_000_000 : 1_000_000)
  ) || !Number.isInteger(input.packs)) return null;
  const paise = (value: number) => Math.round(value * 100);
  const selling = paise(input.selling);
  const variable = paise(input.tea) + paise(input.packaging) + paise(input.freight) + paise(input.fees);
  const contribution = selling - variable;
  const revenue = selling * input.packs;
  const variableCosts = variable * input.packs;
  return {
    revenue, variableCosts, contribution,
    margin: selling > 0 ? contribution / selling * 100 : null,
    surplus: contribution * input.packs - paise(input.fixed),
    breakEven: contribution > 0 ? Math.ceil(paise(input.fixed) / contribution) : null,
  };
}
