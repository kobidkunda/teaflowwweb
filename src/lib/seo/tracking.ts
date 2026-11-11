import { readTrackingConsent, safeTrackingUrl, trackingRouteAllowed } from "./consent";

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

function googleEvent(event: string, params: Record<string, unknown>, ecommerce = false) {
  if (!canTrack()) return false;
  window.dataLayer ||= [];
  const eventId = params.event_id || window.crypto?.randomUUID?.() || `event_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  params = { ...params, event_id: eventId };
  const config = window.__tfTracking;
  // One transport per destination. GTM event tags consume objects; standalone GA4 consumes commands.
  if (config?.gtmEnabled && config.gtmContainerId) {
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({ ...params, event });
  } else if (config?.ga4Enabled && config.ga4MeasurementId && readTrackingConsent().analytics) {
    window.gtag?.("event", event, ecommerce ? { ...(params.ecommerce as Record<string, unknown>), event_id: eventId } : params);
  } else {
    // Keep the public event contract inspectable even when no vendor is configured.
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({ ...params, event });
  }
  return true;
}

export function ensureMetaQueue() {
  if (typeof window === "undefined" || !readTrackingConsent().marketing) return;
  const config = window.__tfTracking;
  if (config?.gtmEnabled && config.gtmContainerId) return;
  if (!config?.metaPixelEnabled || !/^\d+$/.test(config.metaPixelId)) return;
  if (!window.fbq) {
    const queue: NonNullable<Window["fbq"]> = (...args) => {
      if (queue.callMethod) queue.callMethod(...args);
      else queue.queue!.push(args);
    };
    queue.queue = []; queue.loaded = true; queue.version = "2.0"; queue.push = queue;
    window.fbq = queue;
  }
  if (!window.__tfMetaInitialized) {
    window.__tfMetaInitialized = true;
    window.fbq("init", config.metaPixelId);
    // Match only explicitly reviewed data; never scrape checkout contact fields.
    window.fbq("set", "autoConfig", false, config.metaPixelId);
  }
}

function metaEvent(event: string, params: Record<string, unknown> = {}, eventId?: string) {
  if (!canTrack() || !readTrackingConsent().marketing) return;
  if (window.__tfTracking?.gtmEnabled && window.__tfTracking.gtmContainerId) return;
  ensureMetaQueue();
  // Direct Meta is a separate owner. Do not also install the same pixel in GTM.
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
  for (const key of ["lead_type", "interest", "estimated_volume", "search_term", "method", "page_path", "page_title", "page_location", "page_referrer"]) {
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
export function trackViewItem(item: TrackingItem, currency = "INR") {
  const sent = pushEcommerceEvent("view_item", { currency, value: item.price, items: [item] });
  metaEvent("ViewContent", { content_name: item.item_name, content_ids: [item.item_id], content_type: "product", value: item.price, currency });
  return sent;
}
export function trackAddToCart(item: TrackingItem, quantity = 1, currency = "INR") {
  if (quantity <= 0 || !Number.isFinite(quantity)) return false;
  const value = item.price * quantity;
  const sent = pushEcommerceEvent("add_to_cart", { currency, value, items: [{ ...item, quantity }] });
  metaEvent("AddToCart", { content_name: item.item_name, content_ids: [item.item_id], content_type: "product", contents: [{ id: item.item_id, quantity, item_price: item.price }], value, currency });
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
  return sent;
}
export function trackAddShippingInfo(shippingTier: string, items: TrackingItem[], totalValue: number, currency = "INR") {
  return pushEcommerceEvent("add_shipping_info", { currency, value: totalValue, shipping_tier: shippingTier, items });
}
export function trackAddPaymentInfo(paymentType: string, items: TrackingItem[], totalValue: number, currency = "INR") {
  const sent = pushEcommerceEvent("add_payment_info", { currency, value: totalValue, payment_type: paymentType, items });
  metaEvent("AddPaymentInfo", metaContents(items, totalValue, currency));
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
  total?: number
) {
  if (!canTrack() || !transactionId || items.length === 0 || !Number.isFinite(value) || value < 0) return false;
  const consent = readTrackingConsent();
  window.__tfPurchases ||= new Set();
  const seen = (key: string) => {
    if (window.__tfPurchases!.has(key)) return true;
    try { return !!window.localStorage.getItem(key); } catch { return false; }
  };
  const mark = (key: string) => {
    window.__tfPurchases!.add(key);
    try { window.localStorage.setItem(key, "1"); } catch {}
  };
  let sent = false;
  const googleKey = `tf_purchase_v2_google_${transactionId}`;
  const gtmOwnsTags = window.__tfTracking?.gtmEnabled && window.__tfTracking.gtmContainerId;

  const totalAmount =
    total !== undefined && Number.isFinite(total) && total > 0
      ? total
      : Math.max(0, value + (Number.isFinite(shipping) ? shipping : 0) + (Number.isFinite(tax) ? tax : 0));

  if ((consent.analytics || (gtmOwnsTags && consent.marketing)) && !seen(googleKey)) {
    if (pushEcommerceEvent("purchase", { transaction_id: transactionId, currency, value, shipping, tax, items })) {
      mark(googleKey);
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
  if (!gtmOwnsTags && consent.marketing && !seen(metaKey)) {
    ensureMetaQueue();
    if (window.fbq) {
      metaEvent("Purchase", metaContents(items, value, currency), `purchase_${transactionId}`);
      mark(metaKey);
      sent = true;
    }
  }
  return sent;
}

export function trackSearch(searchTerm: string) {
  const term = searchTerm.trim().slice(0, 100);
  if (!term || /@|\d[\d\s()+-]{6,}/.test(term)) return false;
  const sent = pushDataLayerEvent("search", { search_term: term });
  metaEvent("Search", { search_string: term });
  return sent;
}
export function trackLead(leadType: string, meta: Record<string, unknown> = {}) {
  const sent = pushDataLayerEvent("generate_lead", { ...meta, lead_type: leadType });
  metaEvent("Lead", { content_name: leadType });
  return sent;
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
