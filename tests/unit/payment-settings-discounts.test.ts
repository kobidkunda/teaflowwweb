import { describe, it, expect } from "vitest";
import {
  calculatePaymentMethodDiscountPaise,
  type PaymentSettings,
} from "@/lib/paymentSettings";

function mockSettings(overrides: Partial<PaymentSettings> = {}): PaymentSettings {
  return {
    payment_mode: "test",
    razorpay_enabled: true,
    razorpay_key_id: "rzp_test_123",
    razorpay_key_secret: "secret",
    razorpay_webhook_secret: "webhook",
    razorpay_secret_configured: true,
    razorpay_webhook_configured: true,
    razorpay_test_key_id: "rzp_test_123",
    razorpay_test_key_secret: "secret",
    razorpay_test_webhook_secret: "webhook",
    razorpay_test_secret_configured: true,
    razorpay_test_webhook_configured: true,
    razorpay_prod_key_id: "",
    razorpay_prod_key_secret: "",
    razorpay_prod_webhook_secret: "",
    razorpay_prod_secret_configured: false,
    razorpay_prod_webhook_configured: false,
    active_key_id: "rzp_test_123",
    active_secret_configured: true,
    active_webhook_configured: true,
    webhook_url: "https://teafloww.com/api/webhooks/razorpay",
    cod_enabled: true,
    cod_fee_rupees: 50,
    cod_fee_paise: 5000,
    cod_min_rupees: 100,
    cod_max_rupees: 5000,

    upi_discount_enabled: true,
    upi_discount_type: "percentage",
    upi_discount_value: 2,
    upi_discount_max_rupees: 150,

    card_discount_enabled: true,
    card_discount_type: "percentage",
    card_discount_value: 1,
    card_discount_max_rupees: 100,

    netbanking_discount_enabled: true,
    netbanking_discount_type: "percentage",
    netbanking_discount_value: 1,
    netbanking_discount_max_rupees: 100,

    prepaid_discount_enabled: false,
    prepaid_discount_type: "percentage",
    prepaid_discount_value: 0,
    prepaid_discount_max_rupees: 0,

    min_order_for_discount_rupees: 0,
    payment_discount_badge_text: "⚡ Instant 2% Off with UPI · 1% Off on Cards",
    ...overrides,
  };
}

describe("calculatePaymentMethodDiscountPaise", () => {
  it("returns zero discount for Cash on Delivery (COD) orders", () => {
    const settings = mockSettings();
    const result = calculatePaymentMethodDiscountPaise("cod", 200000, settings);
    expect(result.discountPaise).toBe(0);
    expect(result.label).toContain("No payment discount");
  });

  it("returns zero discount when merchandise amount is zero or negative", () => {
    const settings = mockSettings();
    expect(calculatePaymentMethodDiscountPaise("upi", 0, settings).discountPaise).toBe(0);
    expect(calculatePaymentMethodDiscountPaise("upi", -5000, settings).discountPaise).toBe(0);
  });

  it("calculates percentage discount accurately for UPI orders", () => {
    const settings = mockSettings({
      upi_discount_value: 2,
      upi_discount_max_rupees: 150,
    });
    // ₹1,000 merchandise = 100,000 paise -> 2% = 2,000 paise (₹20)
    const result = calculatePaymentMethodDiscountPaise("upi", 100000, settings);
    expect(result.discountPaise).toBe(2000);
    expect(result.ratePercent).toBe(2);
    expect(result.label).toContain("2%");
  });

  it("caps UPI discount at configured maximum amount", () => {
    const settings = mockSettings({
      upi_discount_value: 2,
      upi_discount_max_rupees: 150, // max ₹150 = 15,000 paise
    });
    // ₹10,000 merchandise = 1,000,000 paise -> 2% = 20,000 paise (₹200) -> capped at 15,000 paise (₹150)
    const result = calculatePaymentMethodDiscountPaise("upi", 1000000, settings);
    expect(result.discountPaise).toBe(15000);
  });

  it("calculates flat discount correctly when type is flat", () => {
    const settings = mockSettings({
      upi_discount_type: "flat",
      upi_discount_value: 50, // flat ₹50
    });
    // ₹1,000 merchandise -> flat ₹50 = 5,000 paise
    const result = calculatePaymentMethodDiscountPaise("upi", 100000, settings);
    expect(result.discountPaise).toBe(5000);
    expect(result.label).toContain("₹50 off");
  });

  it("calculates card discount accurately with card settings", () => {
    const settings = mockSettings({
      card_discount_enabled: true,
      card_discount_value: 1,
      card_discount_max_rupees: 100,
    });
    // ₹2,000 merchandise = 200,000 paise -> 1% = 2,000 paise (₹20)
    const result = calculatePaymentMethodDiscountPaise("card", 200000, settings);
    expect(result.discountPaise).toBe(2000);
    expect(result.ratePercent).toBe(1);
  });

  it("calculates netbanking discount accurately", () => {
    const settings = mockSettings({
      netbanking_discount_enabled: true,
      netbanking_discount_value: 1,
    });
    const result = calculatePaymentMethodDiscountPaise("netbanking", 150000, settings);
    expect(result.discountPaise).toBe(1500);
  });

  it("enforces minimum order threshold for discounts", () => {
    const settings = mockSettings({
      min_order_for_discount_rupees: 500, // ₹500 minimum
    });
    // Order of ₹300 (30,000 paise) < ₹500
    const resultLow = calculatePaymentMethodDiscountPaise("upi", 30000, settings);
    expect(resultLow.discountPaise).toBe(0);
    expect(resultLow.label).toContain("below minimum");

    // Order of ₹600 (60,000 paise) >= ₹500
    const resultEligible = calculatePaymentMethodDiscountPaise("upi", 60000, settings);
    expect(resultEligible.discountPaise).toBe(1200); // 2% of 60,000 = 1,200
  });

  it("returns zero discount when discount is disabled", () => {
    const settings = mockSettings({
      upi_discount_enabled: false,
    });
    const result = calculatePaymentMethodDiscountPaise("upi", 100000, settings);
    expect(result.discountPaise).toBe(0);
  });

  it("never lets discount exceed the total merchandise amount", () => {
    const settings = mockSettings({
      upi_discount_type: "flat",
      upi_discount_value: 500, // ₹500 flat discount
      upi_discount_max_rupees: 0, // no max cap so merchandise cap is tested
    });
    // Order of ₹200 (20,000 paise) -> discount capped at 20,000 paise
    const result = calculatePaymentMethodDiscountPaise("upi", 20000, settings);
    expect(result.discountPaise).toBe(20000);
  });
});
