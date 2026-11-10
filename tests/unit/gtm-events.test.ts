import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import vm from "node:vm";
import { trackCartDelta, trackPageView, trackViewItem, trackAddToCart, trackRemoveFromCart, trackViewCart, trackBeginCheckout, trackAddShippingInfo, trackAddPaymentInfo, trackPurchase, trackLead, trackSearch, catalogItem } from "@/lib/seo/tracking";
import { readTrackingConsent, safeTrackingUrl, trackingBootstrap, updateTrackingConsent } from "@/lib/seo/consent";
import type { PublicTrackingConfig } from "@/lib/trackingSettings";

const config: PublicTrackingConfig = { gtmEnabled: true, gtmContainerId: "GTM-M5G27HSQ", ga4Enabled: true, ga4MeasurementId: "G-62FDHK0EQ6", metaPixelEnabled: true, metaPixelId: "123456789", customHeadScript: "", customBodyScript: "" };
const tea = { item_id: "TEA-100", item_name: "Tea", price: 500, quantity: 2 };
const events = () => window.dataLayer!.filter(e => e.event);
beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("window", { dataLayer: [], __tfTracking: config, __tfConsent: { analytics: true, marketing: true }, location: { pathname: "/tea/tea", href: "https://teafloww.com/tea/tea", origin: "https://teafloww.com" }, localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) }, dispatchEvent: vi.fn(), gtag: vi.fn() });
  vi.stubGlobal("document", { title: "Tea", referrer: "" });
});
afterEach(() => vi.unstubAllGlobals());

describe("consent and one-owner Google transport", () => {
  it("blocks all measurement and Meta calls before consent and on administrative routes", () => {
    window.__tfConsent = { analytics: false, marketing: false };
    expect(trackPurchase("paid", 1000, 0, 0, [tea])).toBe(false);
    trackViewItem(tea); trackLead("newsletter"); trackPageView();
    expect(events()).toHaveLength(0); expect(window.fbq).toBeUndefined();
    window.__tfConsent = { analytics: true, marketing: true };
    window.location.pathname = "/admin/orders"; trackViewItem(tea);
    expect(events()).toHaveLength(0);
  });
  it("sends GTM commerce once, with a reset, without also calling gtag event", () => {
    trackViewItem(tea);
    expect(window.dataLayer).toEqual([{ ecommerce: null }, { event: "view_item", event_id: expect.any(String), ecommerce: { currency: "INR", value: 500, items: [tea] } }]);
    expect(window.gtag).not.toHaveBeenCalled();
  });
  it("uses only gtag event in standalone GA4 mode", () => {
    window.__tfTracking = { ...config, gtmEnabled: false };
    trackAddToCart(tea, 3);
    expect(window.gtag).toHaveBeenCalledExactlyOnceWith("event", "add_to_cart", { currency: "INR", value: 1500, items: [{ ...tea, quantity: 3 }], event_id: expect.any(String) });
    expect(events()).toHaveLength(0);
  });
  it("sets defaults before any Google initialization and preserves early events", () => {
    const layer = [{ event: "preexisting" }];
    const context = vm.createContext({ window: { dataLayer: layer }, localStorage: { getItem: () => JSON.stringify({ version: 1, analytics: true, marketing: false }) } });
    vm.runInContext(trackingBootstrap(config), context);
    expect(layer[0]).toEqual({ event: "preexisting" });
    expect(Array.from(layer[1] as unknown as string[]).slice(0, 2)).toEqual(["consent", "default"]);
    expect(Array.from(layer[2] as unknown as string[]).slice(0, 2)).toEqual(["consent", "update"]);
    expect(trackingBootstrap({ ...config, customHeadScript: "</script>" })).not.toContain("</script>");
  });
  it("updates all four Google consent signals and revokes Meta", () => {
    window.fbq = vi.fn(); updateTrackingConsent({ analytics: false, marketing: false });
    expect(window.gtag).toHaveBeenCalledWith("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    expect(window.fbq).toHaveBeenCalledWith("consent", "revoke");
    expect(readTrackingConsent()).toEqual({ analytics: false, marketing: false });
  });
});

describe("commerce data quality", () => {
  it("replaces purchase IDs and clears ecommerce before unrelated events", () => {
    trackPurchase("paid", 1000, 0, 0, [tea]); trackLead("newsletter");
    const recorded = events();
    const purchase = recorded.find(e => e.event === "purchase");
    const teaflowwPurchase = recorded.find(e => e.event === "teafloww_purchase");
    const lead = recorded.find(e => e.event === "generate_lead");
    expect(purchase?.event_id).toBe("purchase_paid");
    expect(teaflowwPurchase?.tf_purchase_order_id).toBe("paid");
    expect(teaflowwPurchase?.tf_purchase_event_id).toBe("purchase_paid");
    expect(lead?.event_id).toBeTypeOf("string");
    expect(lead?.event_id).not.toBe(purchase?.event_id);
    expect(window.dataLayer![window.dataLayer!.length - 2]).toEqual({ ecommerce: null });
  });
  it("resolves missing cart SKUs and suppresses unresolved or denied additions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tracking: { "var-42": tea } }) });
    vi.stubGlobal("fetch", fetchMock);
    await trackCartDelta({ variantId: 42, name: "Tea", pricePaise: 50000 }, 2, "add");
    expect((events()[0].ecommerce as { items: { item_id: string }[] }).items[0].item_id).toBe("TEA-100");
    fetchMock.mockResolvedValue({ ok: false });
    await trackCartDelta({ variantId: 99, name: "Tea", pricePaise: 50000 }, 1, "add");
    expect(events()).toHaveLength(1);
    window.__tfConsent = { analytics: false, marketing: false };
    fetchMock.mockClear();
    await trackCartDelta({ variantId: 99, name: "Tea", pricePaise: 50000 }, 1, "add");
    expect(fetchMock).not.toHaveBeenCalled(); expect(events()).toHaveLength(1);
  });
  it("uses the same SKU and fallback as the product feed", () => {
    expect(catalogItem({ id: 7, name: "Tea" }, { id: 8, sku: " T-8 ", price_paise: 10000 }).item_id).toBe("T-8");
    expect(catalogItem({ id: 7, name: "Tea" }, { id: 8, sku: "", price_paise: 10000 }).item_id).toBe("HTH-7-8");
  });
  it("sends quantity deltas, cart, shipping and payment stages with item arrays", () => {
    trackAddToCart(tea, 3); trackRemoveFromCart(tea, 1); trackViewCart([tea], 1000); trackBeginCheckout([tea], 1000); trackAddShippingInfo("standard", [tea], 1000); trackAddPaymentInfo("upi", [tea], 1000);
    expect(events().map(e => e.event)).toEqual(["add_to_cart", "remove_from_cart", "view_cart", "begin_checkout", "add_shipping_info", "add_payment_info"]);
    expect((events()[0].ecommerce as Record<string, unknown>).value).toBe(1500);
    expect(window.fbq).toBeUndefined(); // GTM owns downstream Meta in this mode.
  });
  it("queues Meta init before early product events and sends purchase contents with a stable event ID", () => {
    window.__tfTracking = { ...config, gtmEnabled: false };
    trackViewItem(tea); trackPurchase("paid-order", 1000, 40, 50, [tea]);
    const queue = window.fbq!.queue!;
    expect(queue[0]).toEqual(["init", "123456789"]);
    expect(queue.find(args => args[1] === "Purchase")).toEqual(["track", "Purchase", expect.objectContaining({ content_ids: ["TEA-100"], contents: [{ id: "TEA-100", quantity: 2, item_price: 500 }] }), { eventID: "purchase_paid-order" }]);
  });
  it("deduplicates purchase across remount, refresh and storage failure", () => {
    expect(trackPurchase("paid-order", 1000, 0, 0, [tea])).toBe(true);
    expect(trackPurchase("paid-order", 1000, 0, 0, [tea])).toBe(false);
    window.__tfPurchases = new Set();
    expect(trackPurchase("paid-order", 1000, 0, 0, [tea])).toBe(false);
    window.localStorage.getItem = () => { throw new Error(); };
    window.localStorage.setItem = () => { throw new Error(); };
    trackPurchase("private-browser", 1000, 0, 0, [tea]);
    expect(trackPurchase("private-browser", 1000, 0, 0, [tea])).toBe(false);
    expect(events().filter(e => e.event === "purchase")).toHaveLength(2);
  });
  it("permits a late standalone Meta purchase without resending a previous analytics purchase", () => {
    window.__tfTracking = { ...config, gtmEnabled: false, ga4Enabled: false };
    window.__tfConsent = { analytics: true, marketing: false };
    trackPurchase("paid", 1000, 0, 0, [tea]);
    window.__tfConsent.marketing = true;
    trackPurchase("paid", 1000, 0, 0, [tea]);
    expect(events().filter(e => e.event === "purchase")).toHaveLength(1);
    expect(window.fbq!.queue!.filter(args => args[1] === "Purchase")).toHaveLength(1);
  });
  it("does not lose purchase when consent arrives after payment status", () => {
    window.__tfConsent = { analytics: false, marketing: false };
    trackPurchase("paid", 1000, 0, 0, [tea]);
    window.__tfConsent.analytics = true;
    expect(trackPurchase("paid", 1000, 0, 0, [tea])).toBe(true);
  });
  it("strips customer fields from item and lead payloads and rejects obvious PII searches", () => {
    trackViewItem({ ...tea, email: "customer@example.com" } as typeof tea);
    trackLead("wholesale_inquiry", { business_name: "Private business", email: "customer@example.com", interest: "bulk" });
    trackSearch("customer@example.com"); trackSearch("+91 98765 43210");
    expect(JSON.stringify(events())).not.toMatch(/customer@example|Private business|business_name|email/);
    expect(events().filter(e => e.event === "search")).toHaveLength(0);
    expect(events().find(e => e.event === "generate_lead")).toMatchObject({ lead_type: "wholesale_inquiry", interest: "bulk" });
  });
  it("redacts order tokens, IDs, recovery parameters and private referrers", () => {
    expect(safeTrackingUrl("https://teafloww.com/purchase/private-order?token=secret")).toBe("https://teafloww.com/purchase");
    expect(safeTrackingUrl("https://teafloww.com/cart?recovery=secret&utm_source=google")).toBe("https://teafloww.com/cart?utm_source=google");
    expect(safeTrackingUrl("https://teafloww.com/account/addresses")).toBe("https://teafloww.com/private");
    window.location.pathname = "/purchase/id"; window.location.href = "https://teafloww.com/purchase/id?token=secret";
    trackPageView(); expect(events()[0]).toMatchObject({ page_location: "https://teafloww.com/purchase", page_title: "Order status" });
  });
  it("validates that the GTM container export JSON covers the full funnel and retargeting", async () => {
    const fs = await import("node:fs");
    const container = JSON.parse(fs.readFileSync("docs/analytics/teafloww-gtm-container-export.json", "utf8"));
    expect(container.exportFormatVersion).toBe(2);
    expect(container.containerVersion.container.publicId).toBe("GTM-M5G27HSQ");

    const tagNames = container.containerVersion.tag.map((t: { name: string }) => t.name);
    expect(tagNames).toContain("Google Tag (GA4 Config - G-62FDHK0EQ6)");
    expect(tagNames).toContain("GA4 - Event - Ecommerce Funnel");
    expect(tagNames).toContain("Google Ads - Conversion - Purchase");
    expect(tagNames).toContain("Google Ads - Dynamic Remarketing (Retail)");
    expect(tagNames).toContain("Meta Pixel - Base & PageView");
    expect(tagNames).toContain("Meta Pixel - Event - Purchase");

    const triggerNames = container.containerVersion.trigger.map((t: { name: string }) => t.name);
    expect(triggerNames).toContain("CE - All Ecommerce Events");
    expect(triggerNames).toContain("CE - purchase");
    expect(triggerNames).toContain("CE - generate_lead");

    const varNames = container.containerVersion.variable.map((v: { name: string }) => v.name);
    expect(varNames).toContain("DLV - ecommerce.items");
    expect(varNames).toContain("DLV - ecommerce.value");
    expect(varNames).toContain("DLV - ecommerce.currency");
    expect(varNames).toContain("DLV - ecommerce.transaction_id");
    expect(varNames).toContain("CJS - Item IDs Array");
    expect(varNames).toContain("CJS - Meta Contents Array");
  });
});
