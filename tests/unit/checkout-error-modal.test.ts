import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LiveCheckout } from "@/components/international/LiveCheckout";

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/checkout",
}));

vi.mock("@/components/CartProvider", () => ({
  useCart: () => ({
    items: [
      {
        variantId: 101,
        quantity: 2,
        pricePaise: 45000,
        name: "Single Estate Darjeeling Spring Flush",
        grams: 100,
        sku: "HTH-DAR-01",
      },
    ],
    subtotal: 90000,
    clearCart: vi.fn(),
    syncCustomerDetails: vi.fn(),
  }),
}));

vi.mock("@/components/international/InternationalProvider", () => ({
  useInternational: () => ({
    country: "IN",
    currency: "INR",
    locale: "en",
    markets: [{ code: "IN", name: "India" }],
    texts: {
      expired: "Your quote expired. Calculate a new total.",
      total: "Total",
      checkout: "Delivery & Payment",
      name: "Full Name",
      phone: "Phone",
      email: "Email",
      country: "Country",
      line1: "Street Address",
      line2: "Apartment, suite, etc.",
      city: "City",
      state: "State",
      postcode: "PIN Code",
      coupon: "Coupon",
      currency: "Currency",
      inrAcceptance: "Accept INR charge",
    },
  }),
}));

describe("LiveCheckout Error Modal Dialog (Modern Web Guidance)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              onlinePaymentEnabled: true,
              discounts: {
                upi: { enabled: true, type: "percentage", value: 2, maxRupees: 200 },
                card: { enabled: true, type: "percentage", value: 1, maxRupees: 100 },
                netbanking: { enabled: true, type: "percentage", value: 1, maxRupees: 100 },
                cod: { enabled: true, feePaise: 5000, feeRupees: 50, minRupees: 100, maxRupees: 5000 },
                minOrderRupees: 0,
                badgeText: "2% Instant Discount",
              },
              shipping: {
                freeShippingThresholdRupees: 599,
                shippingFlatFeeRupees: 50,
                freeShippingEnabled: true,
                dispatchCommitment: "Same-day dispatch",
              },
            }),
        })
      )
    );
  });

  it("renders native <dialog> with accessible attributes, id and dialog classes", () => {
    const html = renderToStaticMarkup(React.createElement(LiveCheckout));

    // Native <dialog> element
    expect(html).toContain('<dialog');
    expect(html).toContain('id="checkout-error-dialog"');
    expect(html).toContain('class="tf-checkout-error-dialog"');

    // Accessibility attributes per Modern Web Guidance
    expect(html).toContain('aria-labelledby="checkout-error-title"');
    expect(html).toContain('aria-describedby="checkout-error-desc"');
    expect(html).toContain('closedby="any"');

    // No redundant role="dialog" or aria-modal on native dialog
    expect(html).not.toContain('<dialog role="dialog"');
    expect(html).not.toContain('<dialog aria-modal="true"');
  });

  it("contains dismiss and action controls inside the dialog", () => {
    const html = renderToStaticMarkup(React.createElement(LiveCheckout));

    // Header close button
    expect(html).toContain('aria-label="Close error notice"');

    // Default action button inside modal
    expect(html).toContain("Got It");
  });

  it("renders live WhatsApp help button with pre-filled order context and accessibility attributes", () => {
    const html = renderToStaticMarkup(React.createElement(LiveCheckout));

    // WhatsApp link targeting official number 917001304853
    expect(html).toContain('https://wa.me/917001304853?text=');

    // Encoded order context in link
    expect(html).toContain(encodeURIComponent("TeaFloww Live Checkout Assistance"));
    expect(html).toContain(encodeURIComponent("Single Estate Darjeeling Spring Flush"));

    // Security & Accessibility attributes per Modern Web Guidance
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('(opens in a new tab)');
    expect(html).toContain('Ping on WhatsApp');
  });
});
