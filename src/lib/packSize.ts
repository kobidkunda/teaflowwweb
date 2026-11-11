/**
 * Format a variant's actual net weight (stored in grams) for storefront labels.
 * Never hardcode "1kg" for all bulk variants.
 */
export function formatPackWeight(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return "—";
  return grams >= 1000 ? `${grams / 1000}kg` : `${grams}g`;
}
