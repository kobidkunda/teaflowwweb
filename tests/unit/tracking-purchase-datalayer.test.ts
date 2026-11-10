import { describe, it, expect, beforeEach } from "vitest";
import { trackPurchase, type TrackingItem } from "@/lib/seo/tracking";
import { updateTrackingConsent, CONSENT_KEY } from "@/lib/seo/consent";

describe("trackPurchase GTM & Meta Pixel dataLayer event", () => {
  const localStorageStore = new Map<string, string>();

  beforeEach(() => {
    localStorageStore.clear();

    const mockLocalStorage = {
      getItem: (key: string) => localStorageStore.get(key) || null,
      setItem: (key: string, val: string) => {
        localStorageStore.set(key, val);
      },
      removeItem: (key: string) => {
        localStorageStore.delete(key);
      },
      clear: () => {
        localStorageStore.clear();
      },
    };

    // Setup window environment
    global.window = {
      location: {
        pathname: "/purchase/order-abc-123",
        origin: "https://teafloww.com",
        href: "https://teafloww.com/purchase/order-abc-123",
      },
      localStorage: mockLocalStorage,
      dataLayer: [],
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
      __tfPurchases: new Set(),
      __tfTracking: {
        gtmContainerId: "GTM-M5G27HSQ",
        gtmEnabled: true,
        ga4MeasurementId: "",
        ga4Enabled: false,
        metaPixelId: "",
        metaPixelEnabled: false,
        customHeadScript: "",
        customBodyScript: "",
      },
    } as unknown as Window & typeof globalThis;

    // Grant consent
    updateTrackingConsent({ analytics: true, marketing: true });
  });

  const sampleItems: TrackingItem[] = [
    {
      item_id: "HTH-TEST-1",
      item_name: "Darjeeling First Flush (100g)",
      price: 950,
      quantity: 2,
    },
  ];

  it("pushes 'teafloww_purchase' event with exact parameters required for GTM Meta Pixel tracking", () => {
    const success = trackPurchase(
      "order-abc-123",
      1900, // value (merchandise without shipping and tax)
      50,   // shipping
      45,   // tax
      sampleItems,
      "INR",
      1995  // total order amount in rupees
    );

    expect(success).toBe(true);

    const dataLayer = window.dataLayer || [];
    const teaflowwPurchaseEvent = dataLayer.find(
      (e) => (e as Record<string, unknown>).event === "teafloww_purchase"
    ) as Record<string, unknown> | undefined;

    expect(teaflowwPurchaseEvent).toBeDefined();
    expect(teaflowwPurchaseEvent?.event).toBe("teafloww_purchase");
    expect(teaflowwPurchaseEvent?.tf_purchase_value).toBe(1995);
    expect(teaflowwPurchaseEvent?.tf_purchase_currency).toBe("INR");
    expect(teaflowwPurchaseEvent?.tf_purchase_order_id).toBe("order-abc-123");
    expect(teaflowwPurchaseEvent?.tf_purchase_event_id).toBe("purchase_order-abc-123");
  });

  it("calculates total amount if total argument is omitted", () => {
    const success = trackPurchase(
      "order-xyz-789",
      1200, // value
      100,  // shipping
      50,   // tax
      sampleItems,
      "INR"
    );

    expect(success).toBe(true);

    const dataLayer = window.dataLayer || [];
    const event = dataLayer.find(
      (e) => (e as Record<string, unknown>).tf_purchase_order_id === "order-xyz-789"
    ) as Record<string, unknown> | undefined;

    expect(event).toBeDefined();
    expect(event?.tf_purchase_value).toBe(1350); // 1200 + 100 + 50
    expect(event?.tf_purchase_event_id).toBe("purchase_order-xyz-789");
  });

  it("deduplicates purchase events so duplicate calls do not fire twice", () => {
    trackPurchase("order-dedup-1", 1000, 0, 0, sampleItems, "INR", 1000);

    const initialLength = (window.dataLayer || []).filter(
      (e) => (e as Record<string, unknown>).event === "teafloww_purchase"
    ).length;
    expect(initialLength).toBe(1);

    // Call again with the same order ID
    const duplicateSuccess = trackPurchase("order-dedup-1", 1000, 0, 0, sampleItems, "INR", 1000);
    expect(duplicateSuccess).toBe(false);

    const afterLength = (window.dataLayer || []).filter(
      (e) => (e as Record<string, unknown>).event === "teafloww_purchase"
    ).length;
    expect(afterLength).toBe(1);
  });
});
