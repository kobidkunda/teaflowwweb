import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";
import { buildMetaPurchasePayload, sendMetaServerPurchaseEvent } from "@/lib/seo/metaCapi";
import type { Quote } from "@/lib/international/models";

const sampleQuote: Quote = {
  id: "quote-1",
  owner: "session-1",
  created: Date.now(),
  expires: Date.now() + 600_000,
  method: "upi",
  currency: "INR",
  totalMinor: 199500,
  subtotalPaise: 190000,
  discountPaise: 0,
  taxPaise: 4500,
  shippingPaise: 5000,
  analyticsTaxMinor: 4500,
  components: {
    merchandise: 190000,
    shipping: 5000,
    duties: 0,
    tax: 4500,
    cod: 0,
    paymentDiscount: 0,
  },
  lines: [
    {
      variantId: 101,
      sku: "TFW-001-100G",
      name: "Darjeeling First Flush",
      grams: 100,
      quantity: 2,
      pricePaise: 95000,
    },
  ],
  input: {
    currency: "INR",
    locale: "en",
    method: "upi",
    coupon: "",
    items: [{ variantId: 101, quantity: 2 }],
    address: {
      name: "Ananya Roy",
      phone: "9876543210",
      email: "Ananya@Example.com",
      country: "IN",
      line1: "123 Tea Estate Road",
      line2: "",
      city: "Siliguri",
      state: "West Bengal",
      postcode: "734005",
    },
  },
} as unknown as Quote;

describe("Meta Server CAPI Purchase Payload & Deduplication", () => {
  const originalToken = process.env.META_CAPI_ACCESS_TOKEN;

  beforeEach(() => {
    delete process.env.META_CAPI_ACCESS_TOKEN;
  });

  afterEach(() => {
    if (originalToken !== undefined) process.env.META_CAPI_ACCESS_TOKEN = originalToken;
    else delete process.env.META_CAPI_ACCESS_TOKEN;
  });

  it("builds a Meta Purchase payload with matching browser event_id, INR currency, order_id, and SHA-256 user_data", () => {
    const payload = buildMetaPurchasePayload("order-abc-123", sampleQuote, {
      fbc: "fb.1.1700000000.testfbclid",
      fbp: "fb.1.1700000000.123456789",
      clientIp: "103.1.2.3",
      userAgent: "Mozilla/5.0",
    });

    const event = (payload.data as Array<Record<string, unknown>>)[0];
    expect(event.event_name).toBe("Purchase");
    expect(event.event_id).toBe("purchase_order-abc-123");
    expect(event.action_source).toBe("website");

    const customData = event.custom_data as Record<string, unknown>;
    expect(customData.currency).toBe("INR");
    expect(customData.value).toBe(1995);
    expect(customData.order_id).toBe("order-abc-123");
    expect(customData.content_type).toBe("product");
    expect(customData.content_ids).toEqual(["TFW-001-100G"]);
    expect(customData.num_items).toBe(2);

    const userData = event.user_data as Record<string, unknown>;
    const expectedEmailHash = createHash("sha256").update("ananya@example.com").digest("hex");
    const expectedPhoneHash = createHash("sha256").update("919876543210").digest("hex");
    expect(userData.em).toEqual([expectedEmailHash]);
    expect(userData.ph).toEqual([expectedPhoneHash]);
    expect(userData.fbc).toBe("fb.1.1700000000.testfbclid");
    expect(userData.fbp).toBe("fb.1.1700000000.123456789");
  });

  it("no-ops gracefully when META_CAPI_ACCESS_TOKEN is not configured", async () => {
    const res = await sendMetaServerPurchaseEvent("order-abc-123", sampleQuote);
    expect(res).toEqual({ sent: false, reason: "no_access_token" });
  });
});
