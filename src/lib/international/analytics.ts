import type { Quote } from "./models";
/** Server-priced, discounted merchandise only. Addresses/contacts never enter the data layer. */
export function quoteAnalytics(q: Quote) {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency: q.currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const divisor = 10 ** digits;
  const grossMerchandise = Math.max(0, q.components.merchandise + (q.components.paymentDiscount ?? 0));
  const baseMerchandise = q.subtotalPaise - q.discountPaise - (q.subscriptionDiscountPaise ?? 0) - (q.paymentDiscountPaise ?? 0);
  // Older stored quotes predate analyticsTaxMinor. Infer their FX ratio without consulting today's rates.
  const taxMinor = q.analyticsTaxMinor ?? (q.components.tax || (baseMerchandise > 0 ? Math.round(q.taxPaise * grossMerchandise / baseMerchandise) : 0));
  const merchandise = Math.max(0, grossMerchandise - (q.components.tax === 0 ? taxMinor : 0));
  let remaining = merchandise;
  const weight = q.lines.reduce((sum, l) => sum + l.pricePaise * l.quantity, 0);
  const items = q.lines.map((line, i) => {
    const minor = i === q.lines.length - 1 ? remaining : Math.min(remaining, Math.round(merchandise * line.pricePaise * line.quantity / Math.max(1, weight)));
    remaining -= minor;
    return { item_id: line.sku, item_name: line.name, quantity: line.quantity, price: minor / line.quantity / divisor };
  });
  return { currency: q.currency, value: merchandise / divisor, total: q.totalMinor / divisor, shipping: q.components.shipping / divisor, tax: taxMinor / divisor, items };
}
