import {
  collectDirectMetaPixelIds,
  readTrackingConsent,
  safeTrackingUrl,
  trackingRouteAllowed,
} from "./consent";
import { getClientAttributionBundle } from "@/lib/funnel/clientAttribution";
import type { ConversionRule, ConversionTriggerEvent } from "@/lib/trackingSettings";

export interface TrackingItem {
  item_id: string;
  item_name: string;
  item_category?: string;
  price: number;
  quantity?: number;
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { loaded?: boolean; version?: string; queue?: unknown[][]; callMethod?: (...args: unknown[]) => void; push?: unknown };
  }
}

export function canTrack() {
  if (typeof window === "undefined" || !trackingRouteAllowed(window.location.pathname)) return false;
  const consent = readTrackingConsent();
  return consent.analytics || consent.marketing;
}

function readSafeAttributionForDataLayer(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const bundle = getClientAttributionBundle();
    const touch = (bundle.lastTouch || {}) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      if (typeof touch[k] === "string" && touch[k].trim()) {
        out[k] = touch[k].trim().slice(0, 150);
      }
    }
    if (Object.keys(out).length > 0 && bundle.funnelName) {
      out.funnel_name = String(bundle.funnelName).slice(0, 60);
    }
    return out;
  } catch {
    return {};
  }
}

function googleEvent(event: string, params: Record<string, unknown>, ecommerce = false) {
  if (!canTrack()) return false;
  window.dataLayer ||= [];
  const eventId = String(
    params.event_id || window.crypto?.randomUUID?.() || `event_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
  const attr = readSafeAttributionForDataLayer();
  params = { ...attr, ...params, event_id: eventId };
  const config = window.__tfTracking;
  const gtmActive = Boolean(config?.gtmEnabled && config.gtmContainerId);
  const analyticsAllowed = readTrackingConsent().analytics;
  const directGa4Allowed = Boolean(
    config?.ga4Enabled && config.ga4MeasurementId && analyticsAllowed && (!gtmActive || config.ga4RunAlongsideGtm)
  );
  // One transport by default; direct GA4 can also run alongside GTM when explicitly opted into Hybrid mode.
  if (gtmActive) {
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({ ...params, event });
    if (directGa4Allowed) {
      window.gtag?.("event", event, ecommerce ? { ...(params.ecommerce as Record<string, unknown>), event_id: eventId } : params);
    }
  } else if (directGa4Allowed) {
    window.gtag?.("event", event, ecommerce ? { ...(params.ecommerce as Record<string, unknown>), event_id: eventId } : params);
  } else {
    // Keep the public event contract inspectable even when no vendor is configured.
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({ ...params, event });
  }
  return true;
}

function createFbqStub() {
  if (window.fbq) return;
  const queue: NonNullable<Window["fbq"]> = (...args) => {
    if (queue.callMethod) queue.callMethod(...args);
    else queue.queue!.push(args);
  };
  queue.queue = [];
  queue.loaded = true;
  queue.version = "2.0";
  queue.push = queue;
  window.fbq = queue;
}

export function ensureMetaQueue(extraPixelIds: string[] = []) {
  if (typeof window === "undefined" || !readTrackingConsent().marketing) return;
  const config = window.__tfTracking;
  const baseIds = config ? collectDirectMetaPixelIds(config) : [];
  const allPixelIds = [...new Set([...baseIds, ...extraPixelIds.filter((id) => /^\d+$/.test(id))])];
  if (allPixelIds.length === 0) return;

  createFbqStub();
  window.__tfMetaInitializedIds ||= new Set<string>();
  for (const pixelId of allPixelIds) {
    if (!window.__tfMetaInitializedIds.has(pixelId)) {
      window.__tfMetaInitializedIds.add(pixelId);
      window.__tfMetaInitialized = true;
      window.fbq?.("init", pixelId);
      // Match only explicitly reviewed data; never scrape checkout contact fields.
      window.fbq?.("set", "autoConfig", false, pixelId);
    }
  }
}

function metaEvent(event: string, params: Record<string, unknown> = {}, eventId?: string) {
  if (!canTrack() || !readTrackingConsent().marketing) return;
  const config = window.__tfTracking;
  const gtmActive = Boolean(config?.gtmEnabled && config.gtmContainerId);
  if (gtmActive && !config?.metaRunAlongsideGtm) return;
  if (!config?.metaPixelEnabled || !/^\d+$/.test(config.metaPixelId)) return;
  ensureMetaQueue([config.metaPixelId]);
  const directCount = config ? collectDirectMetaPixelIds(config).length : 1;
  if (directCount > 1) {
    if (eventId) window.fbq?.("trackSingle", config.metaPixelId, event, params, { eventID: eventId });
    else window.fbq?.("trackSingle", config.metaPixelId, event, params);
    return;
  }
  if (eventId) window.fbq?.("track", event, params, { eventID: eventId });
  else window.fbq?.("track", event, params);
}

function cleanItems(items: TrackingItem[]): TrackingItem[] {
  return items.filter(i => i.item_id && Number.isFinite(i.price) && i.price >= 0 && (i.quantity === undefined || Number.isFinite(i.quantity) && i.quantity > 0)).slice(0, 200).map(i => ({
    item_id: String(i.item_id).slice(0, 100), item_name: i.item_name.slice(0, 150),
    ...(i.item_category ? { item_category: i.item_category.slice(0, 100) } : {}),
    price: i.price, ...(i.quantity === undefined ? {} : { quantity: i.quantity }),
  }));
}

export function catalogItem(product: { id: number; name: string; category?: string }, variant: { id: number; sku?: string | null; price_paise: number }): TrackingItem {
  return { item_id: variant.sku?.trim() || `HTH-${product.id}-${variant.id}`, item_name: product.name, item_category: product.category, price: variant.price_paise / 100 };
}

export function pushDataLayerEvent(event: string, params: Record<string, unknown> = {}) {
  // Explicit property allowlist; callers cannot accidentally send contact fields or arbitrary URLs.
  const safe: Record<string, unknown> = {};
  for (const key of ["lead_type", "interest", "estimated_volume", "search_term", "method", "page_path", "page_title", "page_location", "page_referrer", "checkout_step", "error_code", "error_field"]) {
    if (typeof params[key] === "string") safe[key] = String(params[key]).slice(0, 200);
  }
  return googleEvent(event, safe);
}

export function pushEcommerceEvent(event: string, data: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const key of ["transaction_id", "currency", "value", "shipping", "tax", "shipping_tier", "payment_type", "item_list_name"]) {
    if (typeof data[key] === "string" || typeof data[key] === "number" && Number.isFinite(data[key])) safe[key] = data[key];
  }
  safe.items = cleanItems(Array.isArray(data.items) ? data.items : []);
  return googleEvent(event, { ecommerce: safe, ...(event === "purchase" && safe.transaction_id ? { event_id: `purchase_${safe.transaction_id}` } : {}) }, true);
}

export function trackPageView(path?: string, title?: string, destinations = { google: true, meta: true }) {
  if (!canTrack()) return false;
  const pageLocation = safeTrackingUrl(path || window.location.href, window.location.origin);
  const privateOrder = /^\/(purchase|order)(?:\/|$)/.test(window.location.pathname);
  const page = { page_path: new URL(pageLocation).pathname, page_location: pageLocation, page_title: privateOrder ? "Order status" : title ?? document.title, page_referrer: document.referrer ? safeTrackingUrl(document.referrer) : "" };
  window.gtag?.("set", page);
  const sent = destinations.google ? googleEvent("page_view", page) : false;
  if (destinations.meta) metaEvent("PageView");
  return sent;
}

export function trackViewItemList(items: TrackingItem[], listName = "Catalog", currency = "INR") {
  return pushEcommerceEvent("view_item_list", { item_list_name: listName, currency, items });
}
export function trackSelectItem(item: TrackingItem, listName = "Catalog", currency = "INR") {
  return pushEcommerceEvent("select_item", { item_list_name: listName, currency, items: [item] });
}
const VERIFIED_SETTLED_PAYMENT_STATUSES = new Set(["paid", "cod_remitted", "advance_paid"]);

interface RuleDispatchContext {
  triggerEvent: ConversionTriggerEvent;
  eventId?: string;
  orderTotal?: number;
  merchandiseSubtotal?: number;
  currency?: string;
  transactionId?: string;
  paymentStatus?: string;
  leadType?: string;
  items?: TrackingItem[];
  searchTerm?: string;
}

function seenPurchaseKey(key: string) {
  window.__tfPurchases ||= new Set();
  if (window.__tfPurchases.has(key)) return true;
  try {
    return !!window.localStorage.getItem(key);
  } catch {
    return false;
  }
}

function markPurchaseKey(key: string) {
  window.__tfPurchases ||= new Set();
  window.__tfPurchases.add(key);
  try {
    window.localStorage.setItem(key, "1");
  } catch {}
}

function resolveRuleValue(rule: ConversionRule, ctx: RuleDispatchContext): number | undefined {
  if (rule.value_mode === "none") return undefined;
  if (rule.value_mode === "fixed") {
    return typeof rule.fixed_value === "number" && Number.isFinite(rule.fixed_value) && rule.fixed_value >= 0
      ? Number(rule.fixed_value.toFixed(2))
      : undefined;
  }
  const raw =
    rule.value_mode === "merchandise_subtotal"
      ? ctx.merchandiseSubtotal ?? ctx.orderTotal
      : ctx.orderTotal ?? ctx.merchandiseSubtotal;
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? Number(raw.toFixed(2)) : undefined;
}

function buildRuleEventId(ctx: RuleDispatchContext): string {
  if (ctx.eventId) return ctx.eventId;
  if (ctx.triggerEvent === "purchase" && ctx.transactionId) return `purchase_${ctx.transactionId}`;
  return window.crypto?.randomUUID?.() || `conv_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function dispatchConversionRules(ctx: RuleDispatchContext): number {
  if (!canTrack()) return 0;
  const config = window.__tfTracking;
  const rules = config?.conversionRules;
  if (!Array.isArray(rules) || rules.length === 0) return 0;

  const consent = readTrackingConsent();
  let fired = 0;

  for (const rule of rules) {
    if (!rule.enabled || rule.trigger_event !== ctx.triggerEvent) continue;
    if (
      rule.trigger_event === "generate_lead" &&
      rule.lead_type_filter &&
      rule.lead_type_filter !== "*" &&
      ctx.leadType !== rule.lead_type_filter
    ) {
      continue;
    }
    if (
      rule.trigger_event === "purchase" &&
      rule.paid_only &&
      ctx.paymentStatus &&
      !VERIFIED_SETTLED_PAYMENT_STATUSES.has(ctx.paymentStatus.toLowerCase())
    ) {
      continue;
    }

    const platformAllowed = rule.platform === "ga4" ? consent.analytics : consent.marketing;
    if (!platformAllowed) continue;

    const dedupKey =
      ctx.triggerEvent === "purchase" && ctx.transactionId ? `tf_rule_${rule.id}_${ctx.transactionId}` : "";
    if (dedupKey && seenPurchaseKey(dedupKey)) continue;

    const value = resolveRuleValue(rule, ctx);
    const currency = (rule.currency && rule.currency !== "EVENT" ? rule.currency : ctx.currency || "INR").toUpperCase();
    const eventId = buildRuleEventId(ctx);
    let ruleDispatched = false;

    if (rule.delivery === "admin_direct" || rule.delivery === "both") {
      if (rule.platform === "google_ads") {
        const adsId = (rule.ads_conversion_id || config?.googleAdsId || "").trim().toUpperCase();
        const label = (rule.ads_conversion_label || "").trim();
        if (/^AW-\d+$/.test(adsId) && label && window.gtag) {
          window.gtag("event", "conversion", {
            send_to: `${adsId}/${label}`,
            ...(value !== undefined ? { value, currency } : {}),
            ...(ctx.transactionId ? { transaction_id: ctx.transactionId } : {}),
          });
          ruleDispatched = true;
        }
      } else if (rule.platform === "meta") {
        const pixelId = (rule.meta_pixel_id || config?.metaPixelId || "").trim();
        const metaEventName = (rule.meta_event_name || "").trim();
        if (/^\d+$/.test(pixelId) && metaEventName) {
          ensureMetaQueue([pixelId]);
          const clean = ctx.items ? cleanItems(ctx.items) : [];
          const metaParams: Record<string, unknown> =
            clean.length > 0
              ? metaContents(clean, value ?? 0, currency)
              : {
                  ...(ctx.leadType ? { content_name: ctx.leadType } : {}),
                  ...(ctx.searchTerm ? { search_string: ctx.searchTerm } : {}),
                  ...(value !== undefined ? { value, currency } : {}),
                };
          if (value !== undefined) metaParams.value = value;
          else if (rule.value_mode === "none") delete metaParams.value;
          metaParams.currency = currency;
          if (ctx.transactionId) metaParams.order_id = ctx.transactionId;
          const cmd = rule.meta_is_custom_event ? "trackSingleCustom" : "trackSingle";
          window.fbq?.(cmd, pixelId, metaEventName, metaParams, { eventID: eventId });
          ruleDispatched = true;
        }
      } else if (rule.platform === "ga4") {
        const ga4Event = (rule.custom_event_name || ctx.triggerEvent).trim();
        if (ga4Event && window.gtag) {
          window.gtag("event", ga4Event, {
            event_id: eventId,
            ...(value !== undefined ? { value, currency } : {}),
            ...(ctx.transactionId ? { transaction_id: ctx.transactionId } : {}),
            ...(ctx.leadType ? { lead_type: ctx.leadType } : {}),
          });
          ruleDispatched = true;
        }
      }
    }

    if (rule.delivery === "gtm_datalayer" || rule.delivery === "both") {
      window.dataLayer ||= [];
      const targetId =
        rule.platform === "google_ads"
          ? (rule.ads_conversion_id || config?.googleAdsId || "").trim().toUpperCase()
          : rule.platform === "meta"
            ? (rule.meta_pixel_id || config?.metaPixelId || "").trim()
            : (config?.ga4MeasurementId || "").trim();
      const targetNumeric = targetId.replace(/^AW-/i, "");
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push({
        event: (rule.custom_event_name || "tf_conversion").trim(),
        tf_conversion_id: rule.id,
        tf_conversion_name: rule.name,
        tf_conversion_platform: rule.platform,
        tf_conversion_trigger: ctx.triggerEvent,
        tf_target_id: targetId,
        tf_target_id_numeric: targetNumeric,
        ...(rule.ads_conversion_label ? { tf_conversion_label: rule.ads_conversion_label } : {}),
        ...(rule.meta_event_name ? { tf_meta_event_name: rule.meta_event_name } : {}),
        ...(value !== undefined ? { value, currency } : {}),
        ...(ctx.transactionId ? { transaction_id: ctx.transactionId } : {}),
        ...(ctx.leadType ? { lead_type: ctx.leadType } : {}),
        event_id: eventId,
      });
      ruleDispatched = true;
    }

    if (ruleDispatched) {
      if (dedupKey) markPurchaseKey(dedupKey);
      fired += 1;
    }
  }

  return fired;
}

export function trackViewItem(item: TrackingItem, currency = "INR") {
  const sent = pushEcommerceEvent("view_item", { currency, value: item.price, items: [item] });
  metaEvent("ViewContent", { content_name: item.item_name, content_ids: [item.item_id], content_type: "product", value: item.price, currency });
  dispatchConversionRules({ triggerEvent: "view_item", merchandiseSubtotal: item.price, orderTotal: item.price, currency, items: [item] });
  return sent;
}
export function trackAddToCart(item: TrackingItem, quantity = 1, currency = "INR") {
  if (quantity <= 0 || !Number.isFinite(quantity)) return false;
  const value = item.price * quantity;
  const line = { ...item, quantity };
  const sent = pushEcommerceEvent("add_to_cart", { currency, value, items: [line] });
  metaEvent("AddToCart", { content_name: item.item_name, content_ids: [item.item_id], content_type: "product", contents: [{ id: item.item_id, quantity, item_price: item.price }], value, currency });
  dispatchConversionRules({ triggerEvent: "add_to_cart", merchandiseSubtotal: value, orderTotal: value, currency, items: [line] });
  return sent;
}
export function trackRemoveFromCart(item: TrackingItem, quantity = 1, currency = "INR") {
  return pushEcommerceEvent("remove_from_cart", { currency, value: item.price * quantity, items: [{ ...item, quantity }] });
}
export function trackViewCart(items: TrackingItem[], totalValue: number, currency = "INR") {
  return pushEcommerceEvent("view_cart", { currency, value: totalValue, items });
}
function metaContents(items: TrackingItem[], value: number, currency: string) {
  return { content_type: "product", content_ids: items.map(i => i.item_id), contents: items.map(i => ({ id: i.item_id, quantity: i.quantity ?? 1, item_price: i.price })), num_items: items.reduce((n, i) => n + (i.quantity ?? 1), 0), value, currency };
}
export function trackBeginCheckout(items: TrackingItem[], totalValue: number, currency = "INR") {
  const sent = pushEcommerceEvent("begin_checkout", { currency, value: totalValue, items });
  metaEvent("InitiateCheckout", metaContents(items, totalValue, currency));
  dispatchConversionRules({ triggerEvent: "begin_checkout", merchandiseSubtotal: totalValue, orderTotal: totalValue, currency, items });
  return sent;
}
export function trackAddShippingInfo(shippingTier: string, items: TrackingItem[], totalValue: number, currency = "INR") {
  const sent = pushEcommerceEvent("add_shipping_info", { currency, value: totalValue, shipping_tier: shippingTier, items });
  dispatchConversionRules({ triggerEvent: "add_shipping_info", merchandiseSubtotal: totalValue, orderTotal: totalValue, currency, items });
  return sent;
}
export function trackAddPaymentInfo(paymentType: string, items: TrackingItem[], totalValue: number, currency = "INR") {
  const sent = pushEcommerceEvent("add_payment_info", { currency, value: totalValue, payment_type: paymentType, items });
  metaEvent("AddPaymentInfo", metaContents(items, totalValue, currency));
  dispatchConversionRules({ triggerEvent: "add_payment_info", merchandiseSubtotal: totalValue, orderTotal: totalValue, currency, items });
  return sent;
}
/** Call only with server-confirmed orders (paid or accepted COD). Value excludes shipping and tax; total is full amount in currency units. */
export function trackPurchase(
  transactionId: string,
  value: number,
  shipping: number,
  tax: number,
  items: TrackingItem[],
  currency = "INR",
  total?: number,
  options?: { paymentStatus?: string }
) {
  if (!canTrack() || !transactionId || items.length === 0 || !Number.isFinite(value) || value < 0) return false;
  const consent = readTrackingConsent();
  let sent = false;
  const googleKey = `tf_purchase_v2_google_${transactionId}`;
  const config = window.__tfTracking;
  const gtmOwnsTags = Boolean(config?.gtmEnabled && config.gtmContainerId);

  const totalAmount =
    total !== undefined && Number.isFinite(total) && total > 0
      ? total
      : Math.max(0, value + (Number.isFinite(shipping) ? shipping : 0) + (Number.isFinite(tax) ? tax : 0));

  if ((consent.analytics || (gtmOwnsTags && consent.marketing)) && !seenPurchaseKey(googleKey)) {
    if (pushEcommerceEvent("purchase", { transaction_id: transactionId, currency, value, shipping, tax, items })) {
      markPurchaseKey(googleKey);
      sent = true;
    }
    // Teafloww Custom Data Layer purchase event for Google Tag Manager & Meta Pixel
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "teafloww_purchase",
      ecommerce: { currency, value, items: cleanItems(items) },
      tf_purchase_value: Number(totalAmount.toFixed(2)),
      tf_purchase_currency: currency,
      tf_purchase_order_id: String(transactionId),
      tf_purchase_event_id: `purchase_${transactionId}`,
    });
  }
  const metaKey = `tf_purchase_v2_meta_${transactionId}`;
  const directMetaAllowed = !gtmOwnsTags || Boolean(config?.metaRunAlongsideGtm);
  if (directMetaAllowed && consent.marketing && !seenPurchaseKey(metaKey)) {
    ensureMetaQueue();
    if (window.fbq) {
      metaEvent("Purchase", metaContents(items, value, currency), `purchase_${transactionId}`);
      markPurchaseKey(metaKey);
      sent = true;
    }
  }
  const ruleCount = dispatchConversionRules({
    triggerEvent: "purchase",
    eventId: `purchase_${transactionId}`,
    orderTotal: totalAmount,
    merchandiseSubtotal: value,
    currency,
    transactionId,
    paymentStatus: options?.paymentStatus,
    items,
  });
  return sent || ruleCount > 0;
}

export function trackSearch(searchTerm: string) {
  const term = searchTerm.trim().slice(0, 100);
  if (!term || /@|\d[\d\s()+-]{6,}/.test(term)) return false;
  const sent = pushDataLayerEvent("search", { search_term: term });
  metaEvent("Search", { search_string: term });
  dispatchConversionRules({ triggerEvent: "search", searchTerm: term });
  return sent;
}
export function trackLead(leadType: string, meta: Record<string, unknown> = {}) {
  const sent = pushDataLayerEvent("generate_lead", { ...meta, lead_type: leadType });
  metaEvent("Lead", { content_name: leadType });
  dispatchConversionRules({ triggerEvent: "generate_lead", leadType });
  return sent;
}
export function trackCheckoutDiagnostic(checkoutStep: string, errorCode: string, errorField?: string) {
  return pushDataLayerEvent("checkout_error", {
    checkout_step: checkoutStep,
    error_code: errorCode,
    ...(errorField ? { error_field: errorField } : {}),
  });
}

/** Old bags/editorial cards may lack an SKU. Resolve it rather than sending numeric catalog mismatches. */
export async function trackCartDelta(line: { sku?: string; variantId: number; trialId?: string; name: string; pricePaise: number }, quantity: number, action: "add" | "remove") {
  if (!canTrack() || quantity <= 0) return false;
  let item: TrackingItem | undefined = line.sku ? { item_id: line.sku, item_name: line.name, price: line.pricePaise / 100 } : undefined;
  if (!item) {
    try {
      const identity = line.trialId ? { trialId: line.trialId } : { variantId: line.variantId };
      const response = await fetch(`/api/cart/images?${new URLSearchParams({ items: JSON.stringify([identity]), includeTracking: "1" })}`);
      if (!response.ok) return false;
      const result = await response.json();
      item = result.tracking?.[line.trialId ? `trial-${line.trialId}` : `var-${line.variantId}`];
    } catch { return false; }
  }
  if (!item?.item_id) return false;
  return action === "add" ? trackAddToCart(item, quantity) : trackRemoveFromCart(item, quantity);
}
