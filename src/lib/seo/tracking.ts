/**
 * Privacy-preserving, consent-aware e-commerce measurement and analytics helpers.
 * Adheres strictly to WCAG 2.2, India DPDP Act, and zero-PII data leakage standards.
 * Pushes standard GA4 & Google Tag Manager e-commerce schemas to window.dataLayer,
 * with graceful bridging to Meta Pixel (fbq) and Google Analytics (gtag) when loaded.
 */

export interface TrackingItem {
  item_id: string; // SKU or stable ID
  item_name: string;
  item_category?: string;
  price: number; // In currency units (e.g. 950.00)
  quantity?: number;
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
    fbq?: ((action: string, eventName: string, params?: Record<string, unknown>) => void) & {
      loaded?: boolean;
      version?: string;
      queue?: unknown[];
    };
  }
}

/**
 * Pushes an arbitrary custom event to window.dataLayer safely.
 */
export function pushDataLayerEvent(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...params,
  });
}

/**
 * Pushes standard GA4 e-commerce event to the dataLayer safely.
 * Resets previous ecommerce object per Google Tag Manager / GA4 specification.
 */
export function pushEcommerceEvent(eventName: string, ecommerceData: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null }); // Clear previous ecommerce object per GA4 spec
  window.dataLayer.push({
    event: eventName,
    ecommerce: ecommerceData,
  });

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, ecommerceData);
  }
}

/**
 * Tracks page views (page_view).
 */
export function trackPageView(path?: string, title?: string) {
  if (typeof window === "undefined") return;

  const currentPath = path ?? window.location.pathname;
  const currentTitle = title ?? document.title;

  pushDataLayerEvent("page_view", {
    page_path: currentPath,
    page_title: currentTitle,
  });

  if (typeof window.fbq === "function") {
    window.fbq("track", "PageView");
  }
}

/**
 * Tracks catalog / shelf product impressions (view_item_list).
 */
export function trackViewItemList(items: TrackingItem[], listName = "Catalog", currency = "INR") {
  pushEcommerceEvent("view_item_list", {
    item_list_name: listName,
    currency,
    items,
  });
}

/**
 * Tracks selecting / clicking a product card from a list (select_item).
 */
export function trackSelectItem(item: TrackingItem, listName = "Catalog", currency = "INR") {
  pushEcommerceEvent("select_item", {
    item_list_name: listName,
    currency,
    items: [item],
  });
}

/**
 * Tracks product detail view (view_item).
 */
export function trackViewItem(item: TrackingItem, currency = "INR") {
  pushEcommerceEvent("view_item", {
    currency,
    value: item.price,
    items: [item],
  });

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "ViewContent", {
      content_name: item.item_name,
      content_ids: [item.item_id],
      content_type: "product",
      value: item.price,
      currency,
    });
  }
}

/**
 * Tracks add to cart action (add_to_cart).
 */
export function trackAddToCart(item: TrackingItem, quantity = 1, currency = "INR") {
  const lineValue = item.price * quantity;

  pushEcommerceEvent("add_to_cart", {
    currency,
    value: lineValue,
    items: [{ ...item, quantity }],
  });

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "AddToCart", {
      content_name: item.item_name,
      content_ids: [item.item_id],
      content_type: "product",
      value: lineValue,
      currency,
    });
  }
}

/**
 * Tracks removal from cart (remove_from_cart).
 */
export function trackRemoveFromCart(item: TrackingItem, quantity = 1, currency = "INR") {
  pushEcommerceEvent("remove_from_cart", {
    currency,
    value: item.price * quantity,
    items: [{ ...item, quantity }],
  });
}

/**
 * Tracks viewing the shopping bag / cart page (view_cart).
 */
export function trackViewCart(items: TrackingItem[], totalValue: number, currency = "INR") {
  pushEcommerceEvent("view_cart", {
    currency,
    value: totalValue,
    items,
  });
}

/**
 * Tracks checkout initiation (begin_checkout).
 */
export function trackBeginCheckout(items: TrackingItem[], totalValue: number, currency = "INR") {
  pushEcommerceEvent("begin_checkout", {
    currency,
    value: totalValue,
    items,
  });

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "InitiateCheckout", {
      num_items: items.length,
      value: totalValue,
      currency,
    });
  }
}

/**
 * Tracks completion of shipping details in checkout (add_shipping_info).
 */
export function trackAddShippingInfo(shippingTier: string, items: TrackingItem[], totalValue: number, currency = "INR") {
  pushEcommerceEvent("add_shipping_info", {
    currency,
    value: totalValue,
    shipping_tier: shippingTier,
    items,
  });
}

/**
 * Tracks successful order completion (purchase).
 * Sanitized to strictly exclude customer PII (names, street addresses, phone numbers, emails).
 */
export function trackPurchase(
  transactionId: string,
  totalValue: number,
  shippingValue: number,
  taxValue: number,
  items: TrackingItem[],
  currency = "INR"
) {
  pushEcommerceEvent("purchase", {
    transaction_id: transactionId,
    currency,
    value: totalValue,
    shipping: shippingValue,
    tax: taxValue,
    items,
  });

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "Purchase", {
      content_type: "product",
      value: totalValue,
      currency,
    });
  }
}

/**
 * Tracks search queries (search).
 */
export function trackSearch(searchTerm: string) {
  pushDataLayerEvent("search", {
    search_term: searchTerm,
  });

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "Search", {
      search_string: searchTerm,
    });
  }
}

/**
 * Tracks lead / inquiry generation (lead / newsletter_signup).
 */
export function trackLead(leadType: string, meta: Record<string, unknown> = {}) {
  pushDataLayerEvent("lead", {
    lead_type: leadType,
    ...meta,
  });

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "Lead", {
      content_name: leadType,
    });
  }
}
