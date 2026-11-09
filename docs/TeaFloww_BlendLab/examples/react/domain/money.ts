/** Helpers for a FINANCE-APPROVED service tax classification.
 * Tax rules MUST be server-owned; do not calculate official invoices in browsers.
 * Amounts are integer paise; taxRateBps is basis points, e.g. 1800 = 18%.
 */
export function splitTaxInclusive(totalPaise: number, taxRateBps: number) {
  if (!Number.isSafeInteger(totalPaise) || totalPaise < 0) throw new Error('Invalid total');
  if (!Number.isSafeInteger(taxRateBps) || taxRateBps < 0 || taxRateBps > 10000)
    throw new Error('Invalid tax rate');
  const basePaise = Math.round((totalPaise * 10000) / (10000 + taxRateBps));
  return { basePaise, taxPaise: totalPaise - basePaise, totalPaise };
}

export function formatInr(paise: number) {
  if (!Number.isSafeInteger(paise)) throw new Error('Invalid price');
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
    .format(paise / 100);
}
