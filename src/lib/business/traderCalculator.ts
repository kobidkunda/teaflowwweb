import type { Variant } from "@/lib/productModels";

export type TraderAssumptions = {
  inventory: string; sales: string; resale: string; freight: string; handling: string;
  tax: string; fees: string; loss: string; fixed: string; reserve: string; creditDays: string;
};
export const emptyTraderAssumptions = (): TraderAssumptions => ({ inventory: "50", sales: "", resale: "", freight: "", handling: "", tax: "", fees: "", loss: "", fixed: "", reserve: "", creditDays: "" });

export function validTraderInput(key: keyof TraderAssumptions, value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return false;
  const amount = Number(value);
  if (["inventory", "sales", "creditDays"].includes(key) && !Number.isInteger(amount)) return false;
  if (key === "inventory" && amount < 1) return false;
  return amount <= (key === "loss" ? 100 : key === "creditDays" ? 365 : ["inventory", "sales"].includes(key) ? 100_000 : 10_000_000);
}

export function traderUnitPrice(variant: Variant, inventory: number) {
  const slab = [...(variant.wholesale_slabs || [])].filter(tier => inventory >= tier.min_qty).sort((first, second) => second.min_qty - first.min_qty)[0];
  return { unit: slab?.price_paise ?? variant.price_paise, slab };
}

export function calculateTraderScenario(variant: Variant, input: TraderAssumptions) {
  if ((Object.keys(input) as (keyof TraderAssumptions)[]).some(key => !validTraderInput(key, input[key]))) return null;
  const inventory = Number(input.inventory);
  const sales = Number(input.sales);
  if (sales > inventory) return null;
  const paise = (amount: string) => Math.round(Number(amount) * 100);
  const { unit, slab } = traderUnitPrice(variant, inventory);
  if (!Number.isSafeInteger(unit) || unit <= 0) return null;
  const purchase = unit * inventory;
  const landed = purchase + paise(input.freight) + paise(input.handling) + paise(input.tax);
  const netUnit = Math.round(paise(input.resale) * (10000 - Math.round(Number(input.loss) * 100)) / 10000);
  const contributionNumerator = (netUnit - paise(input.fees)) * inventory - landed;
  const revenue = netUnit * sales;
  const profit = Math.round(contributionNumerator * sales / inventory) - paise(input.fixed);
  return {
    unit, slab, purchase, landed, revenue, profit,
    contribution: Math.round(contributionNumerator / inventory),
    margin: revenue > 0 ? profit / revenue * 100 : null,
    breakEven: contributionNumerator > 0 ? Math.ceil(paise(input.fixed) * inventory / contributionNumerator) : null,
    cash: landed + paise(input.fixed) + paise(input.reserve),
    aboveMrp: Boolean(variant.compare_at_price_paise && paise(input.resale) > variant.compare_at_price_paise),
    freightHeavy: paise(input.freight) > purchase * .2,
    exceedsStock: inventory > variant.stock,
  };
}
