/**
 * Demo storefront totals (single owner of pricing math).
 *
 * Shipping schedule (demo policy, NOT a carrier quote):
 * - Standard dispatch, flat ₹99 below ₹1,50,000 subtotal, complimentary above.
 * - No carrier, PIN-code serviceability, weight slab or delivery-date promise
 *   is implied: the operator confirms the real carrier contract per
 *   docs/OPERATIONS.md §8 before live sales. Catalogue and cart copy must
 *   never present this schedule as a delivery guarantee.
 *
 * GST model (demo assumption, NOT tax advice):
 * - Catalogue prices are GST-INCLUSIVE (Indian retail MRP convention), so the
 *   checkout total never changes: total = subtotal − discount + shipping.
 * - GST_RATE_PERCENT documents the assumed rate used ONLY to break out the
 *   tax portion already inside the merchandise amount for display/records:
 *     tax = round((subtotal − discount) × rate / (100 + rate)).
 * - Shipping is treated as GST-exempt in this breakout (operator confirms
 *   freight HSN treatment with their CA; legal sign-off is an excluded
 *   operator item). The rate is a named constant so the operator replaces it
 *   in one place after professional confirmation.
 */
export const FREE_SHIPPING_THRESHOLD = 150000;
export const SHIPPING_FEE = 9900;
/** Assumed GST rate (percent) for the inclusive-tax breakout. See note above. */
export const GST_RATE_PERCENT = 5;
/** Shipping method label persisted on orders; the only demo method. */
export const SHIPPING_METHOD = "standard" as const;

export function calculateShipping(
  subtotalPaise: number,
  thresholdPaise: number = FREE_SHIPPING_THRESHOLD,
  flatFeePaise: number = SHIPPING_FEE
): number {
  return subtotalPaise >= thresholdPaise ? 0 : flatFeePaise;
}

/**
 * GST portion already included in the merchandise amount
 * (subtotal minus coupon discount, never negative). Pure function of paise
 * integers — no floating-point totals. Returns 0 for non-positive input.
 */
export function calculateTaxPaise(merchandisePaise: number): number {
  if (!Number.isInteger(merchandisePaise) || merchandisePaise <= 0) return 0;
  return Math.round((merchandisePaise * GST_RATE_PERCENT) / (100 + GST_RATE_PERCENT));
}

/** Server-side totals owner: subtotal → discount → shipping → tax breakout. */
export function quoteTotals(
  subtotalPaise: number,
  discountPaise: number,
  options?: { thresholdPaise?: number; flatFeePaise?: number }
): {
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
} {
  const merchandise = Math.max(0, subtotalPaise - discountPaise);
  const shippingPaise = calculateShipping(
    subtotalPaise,
    options?.thresholdPaise ?? FREE_SHIPPING_THRESHOLD,
    options?.flatFeePaise ?? SHIPPING_FEE
  );
  const taxPaise = calculateTaxPaise(merchandise);
  return { shippingPaise, taxPaise, totalPaise: merchandise + shippingPaise };
}

export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0
  }).format(paise / 100);
}
export function cupsFromGrams(grams: number): number {
  return Math.floor(grams / 2);
}

/**
 * Calculates per-cup price in paise from total price in paise and total servings.
 * Strictly guards against non-positive or non-finite servings to avoid division by zero.
 */
export function calculatePerCupPaise(pricePaise: number, servings: number): number {
  if (!Number.isFinite(servings) || servings <= 0 || !Number.isFinite(pricePaise) || pricePaise <= 0) {
    return 0;
  }
  return Math.round(pricePaise / servings);
}

/**
 * Formatted INR currency string representing unit cost per cup.
 * Strictly guards against servings <= 0 so it never divides by zero.
 */
export function formatPerCup(pricePaise: number, servings: number): string {
  const perCupPaise = calculatePerCupPaise(pricePaise, servings);
  return formatINR(perCupPaise);
}
