import { cartImageKey } from "./cartImageHelper";

/** Refresh saved estimates without changing pack identity or requested quantity. */
export function refreshCartPrices<T extends { variantId: number; trialId?: string; pricePaise: number }>(
  items: T[], prices: Record<string, number>,
): T[] {
  return items.map(line => {
    const price = prices[cartImageKey(line)];
    return Number.isSafeInteger(price) && price >= 0 && price !== line.pricePaise
      ? { ...line, pricePaise: price } : line;
  });
}
