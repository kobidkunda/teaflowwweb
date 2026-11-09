import type { Quote } from "./models";
/** Explicit allowlist: quote addresses/contacts never enter the data layer. */
export function quoteAnalytics(q: Quote) {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency: q.currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const divisor = 10 ** digits;
  let remaining = q.components.merchandise;
  const items = q.lines.map((line, i) => {
    const minor = i === q.lines.length - 1 ? remaining : Math.min(remaining, Math.round(q.components.merchandise * line.pricePaise * line.quantity / Math.max(1, q.subtotalPaise)));
    remaining -= minor;
    return { item_id: line.sku, item_name: line.name, quantity: line.quantity, price: minor / line.quantity / divisor };
  });
  return { currency: q.currency, total: q.totalMinor / divisor, shipping: q.components.shipping / divisor, tax: q.components.tax / divisor, items };
}
