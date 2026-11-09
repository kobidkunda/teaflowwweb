import { CommerceError } from "./models";
export function currencyDigits(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}
export function formatMoney(minor: number, currency: string, locale = "en") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 10 ** currencyDigits(currency));
}
/** Decimal rates are converted to rational integers, avoiding floating point totals. */
export function convertPaise(paise: number, rate: string, currency: string, markupBps = 0, step = 1): number {
  if (!Number.isSafeInteger(paise) || paise < 0 || !/^\d+(\.\d{1,12})?$/.test(rate) || !Number.isInteger(step) || step < 1) throw new CommerceError("Invalid conversion.");
  const [whole, fraction = ""] = rate.split(".");
  if (BigInt(whole + fraction) <= 0n || !Number.isInteger(markupBps) || markupBps < 0 || markupBps > 3000) throw new CommerceError("Invalid conversion rate or adjustment.");
  const numerator = BigInt(paise) * BigInt(whole + fraction) * BigInt(10 ** currencyDigits(currency)) * BigInt(10000 + markupBps);
  const denominator = 100n * 10n ** BigInt(fraction.length) * 10000n * BigInt(step);
  const rounded = Number((numerator + denominator / 2n) / denominator) * step;
  if (!Number.isSafeInteger(rounded)) throw new CommerceError("Amount exceeds the supported limit.");
  return rounded;
}
/** Razorpay requires the last minor-unit digit to be zero for three-decimal charges. */
export function gatewayRoundingStep(currency: string, configured = 1) {
  if (currencyDigits(currency) !== 3) return configured;
  let a = configured, b = 10;
  while (b) { const r = a % b; a = b; b = r; }
  return configured / a * 10;
}
