"use client";

import React, { useState, useId } from "react";
import Link from "next/link";
import {
  Zap,
  CreditCard,
  Building2,
  Truck,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export interface PaymentMethodsData {
  discounts: {
    upi: {
      enabled: boolean;
      type: "percentage" | "flat";
      value: number;
      maxRupees: number;
    };
    card: {
      enabled: boolean;
      type: "percentage" | "flat";
      value: number;
      maxRupees: number;
    };
    netbanking: {
      enabled: boolean;
      type: "percentage" | "flat";
      value: number;
      maxRupees: number;
    };
    cod: {
      enabled: boolean;
      feePaise: number;
    };
    minOrderRupees: number;
    badgeText: string;
  };
  shipping: {
    freeShippingThresholdRupees: number;
    freeShippingThresholdPaise: number;
    shippingFlatFeeRupees: number;
    shippingFlatFeePaise: number;
    freeShippingEnabled: boolean;
    dispatchCommitment: string;
  };
}

const PRESET_AMOUNTS = [800, 1500, 2500, 4000];

export function PaymentMethodsInteractiveHub({ data }: { data: PaymentMethodsData }) {
  const [orderAmount, setOrderAmount] = useState<number>(1500);
  const sliderId = useId();

  const upi = data.discounts.upi;
  const card = data.discounts.card;
  const codFeeRupees = Math.round((data.discounts.cod.feePaise || 5000) / 100);
  const freeShipThreshold = data.shipping.freeShippingThresholdRupees || 599;
  const flatShippingRupees = data.shipping.shippingFlatFeeRupees || 99;

  // Calculate discount for amount
  const calculateDiscount = (
    cfg: { enabled: boolean; type: "percentage" | "flat"; value: number; maxRupees: number },
    amount: number
  ) => {
    if (!cfg.enabled || amount < data.discounts.minOrderRupees) return 0;
    let disc = cfg.type === "percentage" ? Math.round((amount * cfg.value) / 100) : cfg.value;
    if (cfg.maxRupees > 0) disc = Math.min(disc, cfg.maxRupees);
    return Math.min(disc, amount);
  };

  const upiDiscount = calculateDiscount(upi, orderAmount);
  const cardDiscount = calculateDiscount(card, orderAmount);
  const shippingFee = orderAmount >= freeShipThreshold ? 0 : flatShippingRupees;

  const upiTotal = orderAmount - upiDiscount + shippingFee;
  const cardTotal = orderAmount - cardDiscount + shippingFee;
  const codTotal = orderAmount + shippingFee + codFeeRupees;

  const upiSavingsVsCod = codTotal - upiTotal;

  return (
    <div className="payment-methods-hub space-y-16">
      {/* SECTION 1: Interactive Savings Simulator */}
      <section
        className="rounded-2xl p-6 sm:p-10 border border-[#d7d5c7] bg-[#fbf8f1] shadow-sm relative overflow-hidden"
        aria-labelledby="simulator-heading"
      >
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eef0e7] text-[#23483a] text-xs font-semibold tracking-wide uppercase mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#b39156]" />
            Live Savings Calculator
          </div>
          <h2 id="simulator-heading" className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal mb-3">
            Calculate your exact savings with prepaid checkout
          </h2>
          <p className="text-sm sm:text-base text-[#46524a] leading-relaxed mb-6">
            Drag the slider to your expected tea order amount and compare the final payable price across UPI, Cards, and Cash on Delivery.
          </p>
        </div>

        {/* Slider Controls */}
        <div className="bg-white rounded-xl p-6 border border-[#e4dfd5] mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <label htmlFor={sliderId} className="text-sm font-semibold text-[#171713]">
              Simulated Order Value:{" "}
              <span className="text-xl sm:text-2xl font-serif text-[#23483a] font-bold">
                ₹{orderAmount.toLocaleString("en-IN")}
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setOrderAmount(amt)}
                  className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                    orderAmount === amt
                      ? "bg-[#23483a] text-white shadow-sm"
                      : "bg-[#f5f3ec] text-[#46524a] hover:bg-[#eae6db]"
                  }`}
                >
                  ₹{amt.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
          </div>

          <input
            id={sliderId}
            type="range"
            min={300}
            max={8000}
            step={50}
            value={orderAmount}
            onChange={(e) => setOrderAmount(Number(e.target.value))}
            className="w-full accent-[#23483a] cursor-pointer h-2 bg-[#eae6db] rounded-lg"
            aria-label="Adjust order amount for savings calculation"
          />

          <div className="flex justify-between text-xs text-[#737067] mt-2">
            <span>₹300</span>
            <span>Free Shipping at ₹{freeShipThreshold}</span>
            <span>₹8,000</span>
          </div>
        </div>

        {/* Live Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: UPI (Hero Card) */}
          <div className="relative rounded-xl p-6 border-2 border-[#23483a] bg-[#f4f7f2] flex flex-col justify-between shadow-md">
            <div className="absolute -top-3.5 right-4 bg-[#23483a] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
              <Zap className="w-3.5 h-3.5 text-[#e5d4a6]" fill="currentColor" />
              Highest Savings
            </div>

            <div>
              <div className="flex items-center gap-2 text-[#23483a] font-bold text-lg mb-1">
                <Zap className="w-5 h-5 text-[#23483a]" />
                UPI & QR Code
              </div>
              <p className="text-xs text-[#526359] mb-4">GPay, PhonePe, Paytm, BHIM</p>

              <div className="space-y-2 text-xs sm:text-sm border-t border-[#dce3d8] pt-3 mb-4">
                <div className="flex justify-between text-[#46524a]">
                  <span>Order Items:</span>
                  <span>₹{orderAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[#166534] font-semibold">
                  <span>⚡ Instant Discount ({upi.value}%):</span>
                  <span>−₹{upiDiscount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[#46524a]">
                  <span>Delivery ({orderAmount >= freeShipThreshold ? "Free" : "Standard"}):</span>
                  <span>{shippingFee === 0 ? "FREE" : `₹${shippingFee}`}</span>
                </div>
                <div className="flex justify-between text-[#46524a]">
                  <span>COD Handling Fee:</span>
                  <span className="text-[#166534] font-semibold">₹0 (Waived)</span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#23483a]/20 pt-4 mt-2">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-semibold text-[#526359]">Net Payable:</span>
                <span className="text-2xl font-serif font-bold text-[#1b382d]">
                  ₹{upiTotal.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="bg-[#e2edd9] text-[#1e4620] text-xs font-medium px-3 py-1.5 rounded text-center">
                🎉 You save <strong>₹{upiSavingsVsCod.toLocaleString("en-IN")}</strong> compared to COD!
              </div>
            </div>
          </div>

          {/* Card 2: Cards & Netbanking */}
          <div className="rounded-xl p-6 border border-[#d7d5c7] bg-white flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-[#171713] font-bold text-lg mb-1">
                <CreditCard className="w-5 h-5 text-[#b39156]" />
                Cards & Net Banking
              </div>
              <p className="text-xs text-[#737067] mb-4">Visa, MasterCard, RuPay, 50+ Banks</p>

              <div className="space-y-2 text-xs sm:text-sm border-t border-[#e4dfd5] pt-3 mb-4">
                <div className="flex justify-between text-[#46524a]">
                  <span>Order Items:</span>
                  <span>₹{orderAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[#166534] font-semibold">
                  <span>💳 Instant Discount ({card.value}%):</span>
                  <span>−₹{cardDiscount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[#46524a]">
                  <span>Delivery:</span>
                  <span>{shippingFee === 0 ? "FREE" : `₹${shippingFee}`}</span>
                </div>
                <div className="flex justify-between text-[#46524a]">
                  <span>COD Handling Fee:</span>
                  <span className="text-[#166534] font-semibold">₹0 (Waived)</span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#e4dfd5] pt-4 mt-2">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-semibold text-[#737067]">Net Payable:</span>
                <span className="text-2xl font-serif font-bold text-[#171713]">
                  ₹{cardTotal.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="bg-[#f5f3ec] text-[#46524a] text-xs font-medium px-3 py-1.5 rounded text-center">
                Save <strong>₹{(codTotal - cardTotal).toLocaleString("en-IN")}</strong> vs COD + earn card reward points
              </div>
            </div>
          </div>

          {/* Card 3: COD */}
          <div className="rounded-xl p-6 border border-[#d7d5c7] bg-[#fbf8f1] flex flex-col justify-between opacity-90">
            <div>
              <div className="flex items-center gap-2 text-[#5c5950] font-bold text-lg mb-1">
                <Truck className="w-5 h-5 text-[#8c887e]" />
                Cash on Delivery (COD)
              </div>
              <p className="text-xs text-[#737067] mb-4">Pay cash at doorstep on delivery</p>

              <div className="space-y-2 text-xs sm:text-sm border-t border-[#e4dfd5] pt-3 mb-4">
                <div className="flex justify-between text-[#46524a]">
                  <span>Order Items:</span>
                  <span>₹{orderAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[#854d0e]">
                  <span>Payment Discount:</span>
                  <span className="font-medium">₹0 (No Discount)</span>
                </div>
                <div className="flex justify-between text-[#46524a]">
                  <span>Delivery:</span>
                  <span>{shippingFee === 0 ? "FREE" : `₹${shippingFee}`}</span>
                </div>
                <div className="flex justify-between text-[#991b1b] font-medium">
                  <span>COD Handling Surcharge:</span>
                  <span>+₹{codFeeRupees}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#e4dfd5] pt-4 mt-2">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-semibold text-[#737067]">Net Payable:</span>
                <span className="text-2xl font-serif font-bold text-[#737067]">
                  ₹{codTotal.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="bg-[#faebeb] text-[#991b1b] text-xs font-medium px-3 py-1.5 rounded text-center">
                Requires phone/OTP verification &amp; takes 1-2 days longer
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Why We Incentivize Prepaid Orders */}
      <section className="space-y-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#b39156]">
            Truth in Sourcing &amp; Operations
          </p>
          <h2 className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal mt-1">
            Why do we give upfront discounts on prepaid payments?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-[#d7d5c7] bg-white space-y-4">
            <div className="w-10 h-10 rounded-lg bg-[#eef0e7] flex items-center justify-center text-[#23483a]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-[#171713]">100% Surcharge Savings Returned to You</h3>
            <p className="text-sm text-[#46524a] leading-relaxed">
              Third-party courier companies charge merchants significant cash handling fees, transit insurance surcharges, and high return-to-origin (RTO) penalties on unaccepted COD parcels. When you pay upfront with UPI or cards, those risks disappear completely. Instead of pocketing the savings, we return them directly to you as instant discounts.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-[#d7d5c7] bg-white space-y-4">
            <div className="w-10 h-10 rounded-lg bg-[#eef0e7] flex items-center justify-center text-[#23483a]">
              <Zap className="w-5 h-5 text-[#b39156]" />
            </div>
            <h3 className="text-lg font-semibold text-[#171713]">Priority Packaging &amp; Instant Dispatch</h3>
            <p className="text-sm text-[#46524a] leading-relaxed">
              Prepaid parcels bypass manual phone verification queues and enter our automated packaging stream immediately at our Siliguri origin hub. Vacuum-sealed tins and foil pouches are packed and handed to premium air-express couriers within 24 hours of ordering.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 3: Detailed Payment Methods Catalogue */}
      <section className="space-y-8" aria-labelledby="catalog-heading">
        <div>
          <h2 id="catalog-heading" className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal">
            Supported Payment Methods &amp; Channels
          </h2>
          <p className="text-sm text-[#46524a] mt-1">
            All electronic transactions are processed through Razorpay’s RBI-authorized 256-bit SSL encrypted payment gateway.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Method 1: UPI */}
          <div className="p-5 rounded-xl border border-[#d7d5c7] bg-white flex flex-col justify-between hover:border-[#23483a] transition-colors">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="p-2 rounded-lg bg-[#eef0e7] text-[#23483a]">
                  <Zap className="w-5 h-5" />
                </span>
                <span className="text-xs font-bold text-[#166534] bg-[#e2edd9] px-2 py-0.5 rounded">
                  {upi.value}% OFF
                </span>
              </div>
              <h3 className="font-semibold text-base text-[#171713]">UPI &amp; QR Code</h3>
              <p className="text-xs text-[#737067] mt-1 mb-3">Instant mobile app authorization</p>
              <ul className="text-xs text-[#46524a] space-y-1.5 mb-4">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /> Google Pay, PhonePe, Paytm
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /> CRED UPI, BHIM, WhatsApp Pay
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /> Instant dynamic QR scan on desktop
                </li>
              </ul>
            </div>
            <div className="text-[11px] text-[#526359] border-t border-[#f0ede6] pt-2">
              Instant refunds processed within minutes if cancelled.
            </div>
          </div>

          {/* Method 2: Cards */}
          <div className="p-5 rounded-xl border border-[#d7d5c7] bg-white flex flex-col justify-between hover:border-[#23483a] transition-colors">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="p-2 rounded-lg bg-[#f5f3ec] text-[#b39156]">
                  <CreditCard className="w-5 h-5" />
                </span>
                <span className="text-xs font-bold text-[#166534] bg-[#e2edd9] px-2 py-0.5 rounded">
                  {card.value}% OFF
                </span>
              </div>
              <h3 className="font-semibold text-base text-[#171713]">Credit &amp; Debit Cards</h3>
              <p className="text-xs text-[#737067] mt-1 mb-3">Domestic &amp; International</p>
              <ul className="text-xs text-[#46524a] space-y-1.5 mb-4">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /> Visa, MasterCard, RuPay
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /> American Express, Diners Club
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /> RBI Tokenization Compliant
                </li>
              </ul>
            </div>
            <div className="text-[11px] text-[#526359] border-t border-[#f0ede6] pt-2">
              Earn card rewards while enjoying instant store discount.
            </div>
          </div>

          {/* Method 3: Netbanking & Wallets */}
          <div className="p-5 rounded-xl border border-[#d7d5c7] bg-white flex flex-col justify-between hover:border-[#23483a] transition-colors">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="p-2 rounded-lg bg-[#f5f3ec] text-[#46524a]">
                  <Building2 className="w-5 h-5" />
                </span>
                <span className="text-xs font-medium text-[#46524a] bg-[#f0ede6] px-2 py-0.5 rounded">
                  50+ Banks
                </span>
              </div>
              <h3 className="font-semibold text-base text-[#171713]">Net Banking &amp; Wallets</h3>
              <p className="text-xs text-[#737067] mt-1 mb-3">Direct account transfer</p>
              <ul className="text-xs text-[#46524a] space-y-1.5 mb-4">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /> HDFC, ICICI, SBI, Axis, Kotak
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /> Paytm Wallet, PhonePe Wallet
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /> MobiKwik, Amazon Pay
                </li>
              </ul>
            </div>
            <div className="text-[11px] text-[#526359] border-t border-[#f0ede6] pt-2">
              Zero surcharge on major Indian banking gateways.
            </div>
          </div>

          {/* Method 4: COD */}
          <div className="p-5 rounded-xl border border-[#d7d5c7] bg-[#fbf8f1] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="p-2 rounded-lg bg-[#eae6db] text-[#737067]">
                  <Truck className="w-5 h-5" />
                </span>
                <span className="text-xs font-semibold text-[#854d0e] bg-[#fef3c7] px-2 py-0.5 rounded">
                  +₹{codFeeRupees} Fee
                </span>
              </div>
              <h3 className="font-semibold text-base text-[#171713]">Cash on Delivery</h3>
              <p className="text-xs text-[#737067] mt-1 mb-3">Pay cash upon parcel delivery</p>
              <ul className="text-xs text-[#5c5950] space-y-1.5 mb-4">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#737067]" /> 19,000+ Indian PIN codes
                </li>
                <li className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-[#b91c1c]" /> No payment method discount
                </li>
                <li className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-[#b91c1c]" /> Manual phone verification call
                </li>
              </ul>
            </div>
            <div className="text-[11px] text-[#8c887e] border-t border-[#eae6db] pt-2">
              Must provide exact change to courier agent at delivery.
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Shipping & Free Delivery Threshold Rule */}
      <section className="p-6 sm:p-8 rounded-xl bg-[#23483a] text-white space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#d7c49e]">
              Direct From Origin Hub
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-normal">
              Free Delivery on orders above ₹{freeShipThreshold}
            </h2>
            <p className="text-sm text-[#e4ede7] max-w-xl">
              Orders of ₹{freeShipThreshold} or more qualify for complimentary nationwide shipping. For smaller orders under ₹{freeShipThreshold}, a nominal flat transit fee of ₹{flatShippingRupees} is applied.
            </p>
          </div>
          <div className="flex-shrink-0">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#b39156] hover:bg-[#c2a064] text-[#171713] font-semibold text-sm transition-colors"
            >
              Shop Fresh Teas
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/20 pt-6 text-xs text-[#e4ede7]">
          <div>
            <strong className="block text-white text-sm font-semibold mb-1">Dispatch Commitment</strong>
            {data.shipping.dispatchCommitment || "Dispatched within 24–48 hours of lot grading"}
          </div>
          <div>
            <strong className="block text-white text-sm font-semibold mb-1">Air Express Couriers</strong>
            Blue Dart, Delhivery, Shadowfax &amp; DTDC air cargo
          </div>
          <div>
            <strong className="block text-white text-sm font-semibold mb-1">Origin Facility</strong>
            Vacuum-sealed at our Siliguri sorting hub, West Bengal
          </div>
        </div>
      </section>

      {/* SECTION 5: Frequently Asked Questions (Accessible Details/Summary) */}
      <section className="space-y-6" aria-labelledby="faq-heading">
        <div>
          <h2 id="faq-heading" className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-[#46524a] mt-1">
            Everything you need to know about payment security, discounts, and order processing.
          </p>
        </div>

        <div className="space-y-4">
          <details className="group border border-[#d7d5c7] rounded-xl bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-base text-[#171713]">
              <span>How is the UPI / prepaid discount applied at checkout?</span>
              <span className="transition group-open:rotate-180 text-[#737067]">▼</span>
            </summary>
            <p className="mt-3 text-sm text-[#46524a] leading-relaxed">
              When you select UPI or Credit/Debit Card during checkout, our pricing engine automatically deducts the instant discount ({upi.value}% for UPI, {card.value}% for Cards) from your merchandise total before computing the final payable amount. There are no promo codes to type or scratch cards to wait for—the discount is instant and transparently itemized.
            </p>
          </details>

          <details className="group border border-[#d7d5c7] rounded-xl bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-base text-[#171713]">
              <span>Is my payment secure on Teafloww?</span>
              <span className="transition group-open:rotate-180 text-[#737067]">▼</span>
            </summary>
            <p className="mt-3 text-sm text-[#46524a] leading-relaxed">
              Yes, 100%. Teafloww uses Razorpay, India’s leading RBI-licensed payment gateway. Your financial credentials never touch our servers. All transactions use 256-bit AES encryption and mandatory two-factor authentication (OTP / UPI PIN) per RBI guidelines.
            </p>
          </details>

          <details className="group border border-[#d7d5c7] rounded-xl bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-base text-[#171713]">
              <span>What happens if an online payment fails or money is debited?</span>
              <span className="transition group-open:rotate-180 text-[#737067]">▼</span>
            </summary>
            <p className="mt-3 text-sm text-[#46524a] leading-relaxed">
              If a payment fails due to a bank timeout, any debited amount is automatically reversed back to your original payment source by the banking network within 24 to 48 banking hours. Our server verifies every payment webhook independently before completing order reserves.
            </p>
          </details>

          <details className="group border border-[#d7d5c7] rounded-xl bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-base text-[#171713]">
              <span>Can I choose Cash on Delivery for trial packs or special blends?</span>
              <span className="transition group-open:rotate-180 text-[#737067]">▼</span>
            </summary>
            <p className="mt-3 text-sm text-[#46524a] leading-relaxed">
              Cash on Delivery is available across 19,000+ Indian PIN codes for standard catalog teas. However, special trial packs (which are already subsidized for discovery) and custom Blend Lab atelier creations require prepaid confirmation due to their custom-crafted nature.
            </p>
          </details>

          <details className="group border border-[#d7d5c7] rounded-xl bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-base text-[#171713]">
              <span>Why is there a ₹{codFeeRupees} handling fee on COD orders?</span>
              <span className="transition group-open:rotate-180 text-[#737067]">▼</span>
            </summary>
            <p className="mt-3 text-sm text-[#46524a] leading-relaxed">
              Courier logistics partners charge a dedicated cash collection and remittance surcharge of ₹50+ per parcel to cover cash handling risk, armed van transfers, and physical receipting. We display this fee transparently rather than inflating tea prices across the board.
            </p>
          </details>
        </div>
      </section>

      {/* SECTION 6: Bottom Hero Call to Action */}
      <section className="text-center py-12 px-6 rounded-2xl bg-[#f5f3ec] border border-[#d7d5c7] space-y-4">
        <h2 className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal">
          Taste Himalayan Teas at Origin Prices
        </h2>
        <p className="text-sm sm:text-base text-[#46524a] max-w-xl mx-auto">
          Explore single-estate first flush Darjeelings, golden-tippy Assams, and rare high-elevation greens. Pay prepaid to claim your instant discount.
        </p>
        <div className="pt-2">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-[#23483a] hover:bg-[#1a382d] text-white font-semibold text-sm transition-colors shadow-sm"
          >
            Explore the Tea Collection
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
