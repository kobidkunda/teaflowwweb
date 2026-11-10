import { discounts, type SubscriptionQuote } from "@/lib/subscriptions/model";
import { quoteAnalytics } from "./analytics";
import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { enabledProductCondition } from "@/lib/productAvailability";
import { validateCouponServer } from "@/lib/storefront";
import { quoteSchema, CommerceError, type Quote, type QuoteLine } from "./models";
import { market, packageConfig, readiness } from "./store";
import { rateFor } from "./fx";
import { convertPaise, gatewayRoundingStep } from "./money";
import { shippingRate } from "./providers";
import { getPaymentSettings, calculatePaymentMethodDiscountPaise } from "@/lib/paymentSettings";
import { getShippingSettings } from "@/lib/shippingSettings";
export function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export async function createQuote(raw: unknown, owner: string, subscription?: SubscriptionQuote): Promise<Quote> {
  const input = quoteSchema.parse(raw);
  if (subscription && input.coupon) throw new CommerceError("Coupons are not valid for subscription orders.");
  const m = market(input.address.country);
  if (!m.enabled || readiness(m).length) throw new CommerceError("Checkout is not available for this destination yet.");
  if (m.blockedPostcodes.includes(input.address.postcode) || m.blockedStates.some(v => v.toLowerCase() === input.address.state.toLowerCase())) throw new CommerceError("Delivery is not available at this address.");
  const pack = packageConfig();
  if (!pack) throw new CommerceError("Delivery configuration is incomplete.");
  const combined = new Map<string, number>();
  input.items.forEach(l => { const key = l.trialId ? `trial:${l.trialId}` : `variant:${l.variantId}`; combined.set(key, (combined.get(key) || 0) + l.quantity); });
  const db = getDb();
  const lines: QuoteLine[] = [];
  for (const [key, quantity] of combined) {
    if (key.startsWith("trial:")) {
      const trialId = key.slice(6);
      const row = db.prepare("SELECT price_paise AS \"pricePaise\",net_weight_g AS grams,sku,title AS name,inventory_quantity AS stock,inventory_policy AS policy FROM trials WHERE id=? AND status='published' AND (SELECT COUNT(*) FROM trial_components WHERE trial_id=trials.id)=4").get(trialId) as { pricePaise?: number; pricepaise?: number; grams: number; sku: string; name: string; stock: number; policy: string } | undefined;
      if (!row || quantity > 20 || (row.policy === "track" && row.stock < quantity) || m.blockedSkus.includes(row.sku)) throw new CommerceError("A selected tasting kit is unavailable for this destination or quantity.");
      const pricePaise = row.pricePaise ?? row.pricepaise ?? 0;
      lines.push({ variantId: 0, trialId, trialTracked: row.policy === "track", quantity, pricePaise, grams: row.grams, sku: row.sku, name: row.name });
      continue;
    }
    const id = Number(key.slice(8));
    const row = db.prepare(`SELECT v.id AS "variantId",v.product_id AS "productId",v.price_paise AS "pricePaise",v.grams,v.sku,v.stock,p.name FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND ${enabledProductCondition("p")} AND p.status='published'`).get(id) as (QuoteLine & { stock: number; pricepaise?: number; variantid?: number; productId?: number; productid?: number }) | undefined;
    if (!row || quantity > 20 || row.stock < quantity || m.blockedSkus.includes(row.sku)) throw new CommerceError("A selected tea is unavailable for this destination or quantity.");
    const pricePaise = row.pricePaise ?? row.pricepaise ?? 0;
    const variantId = row.variantId ?? row.variantid ?? id;
    lines.push({ variantId, quantity, pricePaise, grams: row.grams, sku: row.sku?.trim() || `HTH-${row.productId ?? row.productid}-${variantId}`, name: row.name });
  }
  const subtotalPaise = lines.reduce((s, l) => s + l.pricePaise * l.quantity, 0);
  const coupon = input.coupon ? validateCouponServer(input.coupon, subtotalPaise) : null;
  if (coupon && !coupon.valid) throw new CommerceError(coupon.reason);
  const couponCountry = input.coupon ? db.prepare("SELECT document FROM commerce_config WHERE key=?").get(`coupon:${input.coupon.toUpperCase()}`) as { document: string } | undefined : undefined;
  if (couponCountry) { const allowed = JSON.parse(couponCountry.document) as string[]; if (allowed.length && !allowed.includes(m.code)) throw new CommerceError("This offer is unavailable in the delivery country."); }
  const discountPaise = coupon?.valid ? coupon.discountPaise : 0;
  const subscriptionSavings = subscription ? discounts(subtotalPaise, subscription.policy.baseBps, subscription.policy.prepaidBps, input.method !== "cod") : { base: 0, extra: 0 };
  const merchandise = subtotalPaise - discountPaise - subscriptionSavings.base;
  const shippingBasis = merchandise - subscriptionSavings.extra;

  // Single authoritative delivery & COD settings for domestic orders
  let freeAbovePaise = m.freeAbovePaise;
  let flatShippingPaise = m.flatPaise;
  let codFeePaise = m.cod.feePaise;

  const paySettings = getPaymentSettings();
  if (!paySettings.online_payment_enabled && input.method !== "cod") {
    throw new CommerceError("Online payment is currently disabled. Please checkout using Cash on Delivery.");
  }

  if (m.code === "IN") {
    try {
      const shipSettings = getShippingSettings();

      // Minimum delivery order enforcement
      if (shipSettings.min_delivery_order_paise > 0 && shippingBasis < shipSettings.min_delivery_order_paise) {
        const remainingPaise = shipSettings.min_delivery_order_paise - shippingBasis;
        const remainingRupees = Math.ceil(remainingPaise / 100);
        throw new CommerceError(
          `Minimum order for delivery is ₹${shipSettings.min_delivery_order_rupees}. Please add ₹${remainingRupees} more to your bag.`
        );
      }

      // COD eligibility enforcement
      if (input.method === "cod") {
        if (!shipSettings.cod_enabled) {
          throw new CommerceError("Cash on delivery is not available for this order. (Cash on delivery is currently disabled)");
        }
        if (shipSettings.cod_min_paise > 0 && shippingBasis < shipSettings.cod_min_paise) {
          throw new CommerceError(`Cash on delivery is not available for this order. (Requires a minimum order of ₹${shipSettings.cod_min_rupees})`);
        }
        if (shipSettings.cod_max_paise > 0 && shippingBasis > shipSettings.cod_max_paise) {
          throw new CommerceError(`Cash on delivery is not available for this order. (Available for orders up to ₹${shipSettings.cod_max_rupees})`);
        }
        const cleanPostcode = (input.address.postcode || "").trim().replace(/\s+/g, "");
        if (shipSettings.cod_postcodes.length > 0 && cleanPostcode && !shipSettings.cod_postcodes.includes(cleanPostcode)) {
          throw new CommerceError(`Cash on delivery is not available for this order. (Not serviceable for PIN code ${cleanPostcode})`);
        }
        if (shipSettings.cod_blocked_skus.length > 0 && lines.some(l => shipSettings.cod_blocked_skus.includes(l.sku))) {
          throw new CommerceError("Cash on delivery is not available for this order. (One or more items in your bag are excluded)");
        }
      }

      if (shipSettings.free_shipping_enabled) {
        freeAbovePaise = shipSettings.free_shipping_threshold_paise;
      } else {
        freeAbovePaise = null;
      }
      flatShippingPaise = shipSettings.shipping_flat_fee_paise;
      codFeePaise = shipSettings.cod_fee_paise;
    } catch (err) {
      if (err instanceof CommerceError) throw err;
    }
  } else {
    if (input.method === "cod" && (!m.cod.enabled || (m.cod.postcodes.length > 0 && !m.cod.postcodes.includes(input.address.postcode)) || shippingBasis < m.cod.minPaise || shippingBasis > m.cod.maxPaise || lines.some(l => m.cod.blockedSkus.includes(l.sku)))) {
      throw new CommerceError("Cash on delivery is not available for this order.");
    }
  }

  if (input.method === "cod" && input.currency !== "INR") throw new CommerceError("Cash on delivery is payable in INR.");
  if (!m.approvedCurrencies.includes(input.currency)) throw new CommerceError("This currency is not enabled for payment. Select INR to accept an INR charge.");
  const fx = rateFor(input.currency, true);

  let rate: import("./providers").ShippingRate;
  try {
    rate = await shippingRate(input, lines, pack, m.duties === "included");
  } catch (err) {
    if (m.code === "IN" && m.shipping === "flat" && err instanceof CommerceError && err.message.includes("service is temporarily unavailable")) {
      rate = {
        id: "standard-flat",
        costPaise: flatShippingPaise,
        expires: Date.now() + 15 * 60000,
        cod: true,
        ddp: false,
        dutiesPaise: 0,
      };
    } else {
      throw err;
    }
  }
  if (rate.expires <= Date.now() || (m.duties === "included" && !rate.ddp) || (input.method === "cod" && !rate.cod)) throw new CommerceError("The selected delivery option is unavailable.");

  const override = m.deliveryOverrides.find(r => r.postcodes.includes(input.address.postcode)) || m.deliveryOverrides.find(r => r.states.some(s => s.toLowerCase() === input.address.state.toLowerCase()));
  const threshold = override ? override.freeAbovePaise : freeAbovePaise;
  const baseShipping = override ? override.flatPaise : m.shipping === "flat" ? flatShippingPaise : rate.costPaise;
  const shippingPaise = (!override && m.shipping === "included") || (threshold !== null && shippingBasis >= threshold) ? 0 : Math.max(0, baseShipping + m.handlingPaise - m.subsidyPaise);

  // Payment method discount (e.g. 2% instant discount for UPI, 1% for Card in India)
  let paymentDiscountPaise = subscriptionSavings.extra;
  if (!subscription && m.code === "IN" && input.method !== "cod") {
    try {
      const paySettings = getPaymentSettings();
      const discountResult = calculatePaymentMethodDiscountPaise(input.method, merchandise, paySettings);
      paymentDiscountPaise = discountResult.discountPaise;
    } catch {}
  }

  const netMerchandisePaise = Math.max(0, merchandise - paymentDiscountPaise);
  const taxPaise = Math.round(netMerchandisePaise * m.taxPercent / (m.taxInclusive ? 100 + m.taxPercent : 100));
  const convert = (v: number) => convertPaise(v, fx.rate, input.currency, m.fxMarkupBps, gatewayRoundingStep(input.currency, m.roundingMinor));
  const components = {
    merchandise: convert(merchandise),
    ...(paymentDiscountPaise > 0 ? { paymentDiscount: -convert(paymentDiscountPaise) } : {}),
    shipping: convert(shippingPaise),
    duties: convert(rate.dutiesPaise),
    tax: m.taxInclusive ? 0 : convert(taxPaise),
    cod: input.method === "cod" ? convert(codFeePaise) : 0,
  };

  const totalPaise = netMerchandisePaise + shippingPaise + rate.dutiesPaise + (m.taxInclusive ? 0 : taxPaise) + (input.method === "cod" ? codFeePaise : 0);
  const q: Quote = { ...(subscription ? { subscription, subscriptionDiscountPaise: subscriptionSavings.base } : {}), id: randomUUID(), owner, fingerprint: hash(input), input, lines, marketVersion: m.version, currency: input.currency, rate: fx.rate, rateId: fx.id,
    expires: Math.min(Date.now() + 15 * 60000, rate.expires), created: Date.now(), carrier: rate.id, carrierCostPaise: rate.costPaise, dutiesPaise: rate.dutiesPaise,
    subtotalPaise, discountPaise, paymentDiscountPaise, shippingPaise, taxPaise, totalPaise,
    analyticsTaxMinor: convert(taxPaise), components, totalMinor: Object.values(components).reduce((s, v) => s + v, 0), package: pack };
  db.prepare("INSERT INTO commerce_quotes (id,owner,document,expires_ms) VALUES (?,?,?,?)").run(q.id, owner, JSON.stringify(q), q.expires);
  return q;
}
export function getQuote(id: string, owner: string): Quote {
  const row = getDb().prepare("SELECT document FROM commerce_quotes WHERE id=? AND owner=?").get(id, owner) as { document: string } | undefined;
  if (!row) throw new CommerceError("Quote not found. Please request a new quote.");
  const q = JSON.parse(row.document) as Quote;
  const m = market(q.input.address.country);
  if (q.expires <= Date.now() || !m.enabled || m.version !== q.marketVersion || readiness(m).length) throw new CommerceError("Your quote has changed or expired. Please review a new quote.");
  rateFor(q.currency, true);
  return q;
}
export function publicQuote(q: Quote) {
  return {
    id: q.id,
    currency: q.currency,
    components: q.components,
    totalMinor: q.totalMinor,
    expires: q.expires,
    analytics: quoteAnalytics(q),
    dutiesMode: market(q.input.address.country).duties,
    method: q.input.method,
    rate: q.rate,
    paymentDiscountPaise: q.paymentDiscountPaise || 0,
    subscriptionDiscountPaise: q.subscriptionDiscountPaise || 0,
    subtotalPaise: q.subtotalPaise,
    shippingPaise: q.shippingPaise,
    totalPaise: q.totalPaise,
    lines: q.lines,
  };
}
