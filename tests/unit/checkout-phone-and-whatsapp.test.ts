import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PhoneInputField,
  validatePhoneNumber,
  formatPhoneNumberIntl,
} from "@/components/checkout/PhoneInputField";
import { LiveCheckout } from "@/components/international/LiveCheckout";
import CheckoutPage from "@/app/checkout/page";

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
  Text: ({ fallback }: { fallback: string }) => fallback,
  LocalizedLink: ({ href, children, ...props }: any) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("@/lib/storeSettings", () => ({
  getStoreSettings: () => ({
    whatsapp_number: "+91 7001304853",
  }),
}));

describe("Phone Validation Package & As-You-Type Formatting", () => {
  it("validates Indian phone numbers correctly with and without leading +", () => {
    expect(validatePhoneNumber("+919876543210")).toBe(true);
    expect(validatePhoneNumber("+91 98765 43210")).toBe(true);
    // Local 10-digit Indian number without prefix
    expect(validatePhoneNumber("9876543210", "IN")).toBe(true);
  });

  it("validates international phone numbers from other countries", () => {
    // US number
    expect(validatePhoneNumber("+12025550123")).toBe(true);
    expect(validatePhoneNumber("+1 (202) 555-0123")).toBe(true);

    // UK number
    expect(validatePhoneNumber("+447911123456")).toBe(true);

    // UAE number
    expect(validatePhoneNumber("+971501234567")).toBe(true);
  });

  it("rejects invalid or too short numbers", () => {
    expect(validatePhoneNumber("12345")).toBe(false);
    expect(validatePhoneNumber("")).toBe(false);
    expect(validatePhoneNumber(null)).toBe(false);
    expect(validatePhoneNumber(undefined)).toBe(false);
    expect(validatePhoneNumber("abcdefghijk")).toBe(false);
  });

  it("formats international numbers properly", () => {
    expect(formatPhoneNumberIntl("+919876543210")).toBe("+91 98765 43210");
    expect(formatPhoneNumberIntl("+12025550123")).toBe("+1 202 555 0123");
  });

  it("renders PhoneInputField with accessible attributes, country selector and flags", () => {
    const html = renderToStaticMarkup(
      React.createElement(PhoneInputField, {
        id: "checkout-phone-input",
        name: "phone",
        country: "IN",
        value: "+919876543210",
        onChange: () => {},
        required: true,
      })
    );

    // Contains input with proper type and autocomplete
    expect(html).toContain('id="checkout-phone-input"');
    expect(html).toContain('name="phone"');
    expect(html).toContain('type="tel"');
    expect(html.toLowerCase()).toContain('autocomplete="tel"');
    expect(html.toLowerCase()).toContain('inputmode="tel"');

    // Contains country select with India selected by default
    expect(html).toContain('class="PhoneInputCountrySelect"');
    expect(html).toContain('value="IN" selected=""');

    // Formatted value is displayed
    expect(html).toContain('value="+91 98765 43210"');
  });

  it("supports error state with aria-invalid on PhoneInputField", () => {
    const html = renderToStaticMarkup(
      React.createElement(PhoneInputField, {
        id: "checkout-phone-input",
        name: "phone",
        country: "IN",
        value: "+9112345",
        onChange: () => {},
        error: "Please enter a valid contact phone number with country code.",
        "aria-describedby": "checkout-phone-error",
      })
    );

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="checkout-phone-error"');
  });
});

describe("Checkout WhatsApp Help Button for Stuck Users", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              onlinePaymentEnabled: true,
              whatsappNumber: "+91 7001304853",
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

  it("renders a persistent floating WhatsApp help button on LiveCheckout for stuck users", () => {
    const html = renderToStaticMarkup(React.createElement(LiveCheckout));

    // Floating support container
    expect(html).toContain('aria-label="Customer Checkout Assistance"');
    expect(html).toContain("Need Help?");
    expect(html).toContain("Chat on WhatsApp");

    // Live link targeting official helpline +91 7001304853
    expect(html).toContain("https://wa.me/917001304853?text=");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');

    // Contextual order information is encoded
    expect(html).toContain(encodeURIComponent("TeaFloww Live Checkout Assistance"));
    expect(html).toContain(encodeURIComponent("Single Estate Darjeeling Spring Flush"));
  });

  it("renders the phone input component with country code auto-selected in LiveCheckout", () => {
    const html = renderToStaticMarkup(React.createElement(LiveCheckout));

    // Phone input container
    expect(html).toContain('data-testid="phone-input-field"');
    expect(html).toContain('id="checkout-phone-input"');
    expect(html).toContain('class="PhoneInputCountrySelect"');
    expect(html).toContain(
      "Country code auto-selected. Change anytime; number formats as you type."
    );
  });

  it("renders WhatsApp help button in the checkout page header", () => {
    const html = renderToStaticMarkup(React.createElement(CheckoutPage));

    expect(html).toContain("Stuck? Chat on WhatsApp");
    expect(html).toContain("https://wa.me/917001304853?text=");
    expect(html).toContain("+91 7001304853");
  });
});
