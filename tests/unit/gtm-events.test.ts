import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  trackPageView,
  trackViewItem,
  trackAddToCart,
  trackRemoveFromCart,
  trackViewCart,
  trackBeginCheckout,
  trackPurchase,
  trackLead,
  trackSearch,
  type TrackingItem,
} from "@/lib/seo/tracking";

describe("Google Tag Manager & Meta Pixel Event Tracking", () => {
  beforeEach(() => {
    // Setup mock window environment for Node vitest runner
    const mockWindow = {
      dataLayer: [] as Array<Record<string, unknown>>,
      gtag: undefined as unknown,
      fbq: undefined as unknown,
      location: { pathname: "/tea/darjeeling-spring" },
    };
    (globalThis as unknown as { window: typeof mockWindow }).window = mockWindow;
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("pushes view_item event with standard GA4 schema and clears previous ecommerce object", () => {
    const item: TrackingItem = {
      item_id: "DJ-SP-100G",
      item_name: "Darjeeling Spring Clonal First Flush",
      item_category: "Black Tea",
      price: 950.0,
      quantity: 1,
    };

    trackViewItem(item, "INR");

    const dl = (globalThis as unknown as { window: { dataLayer: Array<Record<string, unknown>> } }).window.dataLayer;
    expect(dl.length).toBe(2);
    expect(dl[0]).toEqual({ ecommerce: null });
    expect(dl[1]).toEqual({
      event: "view_item",
      ecommerce: {
        currency: "INR",
        value: 950.0,
        items: [item],
      },
    });
  });

  it("pushes add_to_cart with line total value calculation", () => {
    const item: TrackingItem = {
      item_id: "AS-GB-250G",
      item_name: "Assam Golden Breakfast",
      item_category: "Black Tea",
      price: 650.0,
    };

    trackAddToCart(item, 3, "INR");

    const dl = (globalThis as unknown as { window: { dataLayer: Array<Record<string, unknown>> } }).window.dataLayer;
    const event = dl.find((e) => e.event === "add_to_cart");
    expect(event).toBeDefined();
    expect(event?.ecommerce).toEqual({
      currency: "INR",
      value: 1950.0, // 650 * 3
      items: [{ ...item, quantity: 3 }],
    });
  });

  it("pushes remove_from_cart when an item is removed from bag", () => {
    const item: TrackingItem = {
      item_id: "AS-GB-250G",
      item_name: "Assam Golden Breakfast",
      price: 650.0,
      quantity: 1,
    };

    trackRemoveFromCart(item, 1, "INR");

    const dl = (globalThis as unknown as { window: { dataLayer: Array<Record<string, unknown>> } }).window.dataLayer;
    const event = dl.find((e) => e.event === "remove_from_cart");
    expect(event).toBeDefined();
    expect(event?.ecommerce).toEqual({
      currency: "INR",
      value: 650.0,
      items: [{ ...item, quantity: 1 }],
    });
  });

  it("pushes begin_checkout with cart items list", () => {
    const items: TrackingItem[] = [
      { item_id: "1", item_name: "Tea 1", price: 500, quantity: 1 },
      { item_id: "2", item_name: "Tea 2", price: 300, quantity: 2 },
    ];

    trackBeginCheckout(items, 1100, "INR");

    const dl = (globalThis as unknown as { window: { dataLayer: Array<Record<string, unknown>> } }).window.dataLayer;
    const event = dl.find((e) => e.event === "begin_checkout");
    expect(event).toBeDefined();
    expect(event?.ecommerce).toEqual({
      currency: "INR",
      value: 1100,
      items,
    });
  });

  it("pushes purchase event with zero PII leakage", () => {
    const items: TrackingItem[] = [
      { item_id: "DJ-SP-100G", item_name: "Darjeeling Spring", price: 950, quantity: 1 },
    ];

    trackPurchase("ORD-987654", 1045, 0, 95, items, "INR");

    const dl = (globalThis as unknown as { window: { dataLayer: Array<Record<string, unknown>> } }).window.dataLayer;
    const event = dl.find((e) => e.event === "purchase");
    expect(event).toBeDefined();
    expect(event?.ecommerce).toEqual({
      transaction_id: "ORD-987654",
      currency: "INR",
      value: 1045,
      shipping: 0,
      tax: 95,
      items,
    });

    // Verify zero PII: no name, email, phone, or address
    const payloadStr = JSON.stringify(event);
    expect(payloadStr).not.toContain("customer");
    expect(payloadStr).not.toContain("email");
    expect(payloadStr).not.toContain("address");
  });

  it("forwards events to Meta Pixel fbq when loaded", () => {
    const fbqMock = vi.fn();
    (globalThis as unknown as { window: { fbq: typeof fbqMock } }).window.fbq = fbqMock;

    const item: TrackingItem = {
      item_id: "DJ-SP-100G",
      item_name: "Darjeeling Spring",
      price: 950,
      quantity: 1,
    };

    trackViewItem(item);
    expect(fbqMock).toHaveBeenCalledWith("track", "ViewContent", {
      content_name: "Darjeeling Spring",
      content_ids: ["DJ-SP-100G"],
      content_type: "product",
      value: 950,
      currency: "INR",
    });

    trackAddToCart(item, 2);
    expect(fbqMock).toHaveBeenCalledWith("track", "AddToCart", {
      content_name: "Darjeeling Spring",
      content_ids: ["DJ-SP-100G"],
      content_type: "product",
      value: 1900,
      currency: "INR",
    });

    trackLead("newsletter");
    expect(fbqMock).toHaveBeenCalledWith("track", "Lead", {
      content_name: "newsletter",
    });
  });

  it("pushes page_view and search events correctly", () => {
    trackPageView("/shop", "Tea Shop");
    const dl = (globalThis as unknown as { window: { dataLayer: Array<Record<string, unknown>> } }).window.dataLayer;
    const pageViewEvent = dl.find((e) => e.event === "page_view");
    expect(pageViewEvent).toBeDefined();
    expect(pageViewEvent?.page_path).toBe("/shop");

    trackSearch("darjeeling first flush");
    const searchEvent = dl.find((e) => e.event === "search");
    expect(searchEvent).toBeDefined();
    expect(searchEvent?.search_term).toBe("darjeeling first flush");
  });

  it("pushes view_cart with items list and total value", () => {
    const items: TrackingItem[] = [
      { item_id: "DJ-SP-100G", item_name: "Darjeeling Spring", price: 950, quantity: 1 },
    ];
    trackViewCart(items, 950, "INR");
    const dl = (globalThis as unknown as { window: { dataLayer: Array<Record<string, unknown>> } }).window.dataLayer;
    const cartEvent = dl.find((e) => e.event === "view_cart");
    expect(cartEvent).toBeDefined();
    expect(cartEvent?.ecommerce).toEqual({
      currency: "INR",
      value: 950,
      items,
    });
  });
});
