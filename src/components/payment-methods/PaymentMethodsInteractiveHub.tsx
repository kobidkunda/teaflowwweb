"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
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
  onlinePaymentEnabled?: boolean;
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
      {/* Store Notice: When online payments are disabled */}
      {data.onlinePaymentEnabled === false && (
        <div className="p-4 sm:p-5 rounded-xl border border-[#fde047] bg-[#fefce8] text-[#854d0e] flex items-center gap-3 shadow-sm">
          <Truck className="w-6 h-6 flex-shrink-0 text-[#854d0e]" />
          <div>
            <h3 className="font-bold text-sm"><StorefrontText id="copy_e8dbc108418ab055" fallback="Store Notice: Cash on Delivery Only Mode" /></h3>
            <p className="text-xs mt-0.5 text-[#92400e]"><StorefrontText id="copy_ac3c47747e86fd83" fallback="Online payment gateways (UPI, Cards, Net Banking) are currently paused. We are currently accepting orders exclusively via Cash on Delivery (COD) across India." />
            </p>
          </div>
        </div>
      )}

      {/* SECTION 1: Interactive Savings Simulator */}
      <section
        className="rounded-2xl p-6 sm:p-10 border border-[#d7d5c7] bg-[#fbf8f1] shadow-sm relative overflow-hidden"
        aria-labelledby="simulator-heading"
      >
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eef0e7] text-[#23483a] text-xs font-semibold tracking-wide uppercase mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#b39156]" /><StorefrontText id="copy_7c663d7377775b5a" fallback="Live Savings Calculator" />
          </div>
          <h2 id="simulator-heading" className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal mb-3"><StorefrontText id="copy_1419cc8d37ccd1eb" fallback="Calculate your exact savings with prepaid checkout" />
          </h2>
          <p className="text-sm sm:text-base text-[#46524a] leading-relaxed mb-6"><StorefrontText id="copy_fa344980b94c41b4" fallback="Drag the slider to your expected tea order amount and compare the final payable price across UPI, Cards, and Cash on Delivery." />
          </p>
        </div>

        {/* Slider Controls */}
        <div className="bg-white rounded-xl p-6 border border-[#e4dfd5] mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <label htmlFor={sliderId} className="text-sm font-semibold text-[#171713]"><StorefrontText id="copy_83bd6f96d89522c4" fallback="Simulated Order Value:" />{" "}
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
            <span><StorefrontText id="copy_5ec27502c305a8ea" fallback="Free Shipping at ₹" />{freeShipThreshold}</span>
            <span>₹8,000</span>
          </div>
        </div>

        {/* Live Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: UPI (Hero Card) */}
          <div className="relative rounded-xl p-6 border-2 border-[#23483a] bg-[#f4f7f2] flex flex-col justify-between shadow-md">
            <div className="absolute -top-3.5 right-4 bg-[#23483a] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
              <Zap className="w-3.5 h-3.5 text-[#e5d4a6]" fill="currentColor" /><StorefrontText id="copy_38b3a4ee97911f77" fallback="Highest Savings" />
            </div>

            <div>
              <div className="flex items-center gap-2 text-[#23483a] font-bold text-lg mb-1">
                <Zap className="w-5 h-5 text-[#23483a]" />
                UPI & QR Code
              </div>
              <p className="text-xs text-[#526359] mb-4"><StorefrontText id="copy_6fcb334fdf1a8724" fallback="GPay, PhonePe, Paytm, BHIM" /></p>

              <div className="space-y-2 text-xs sm:text-sm border-t border-[#dce3d8] pt-3 mb-4">
                <div className="flex justify-between text-[#46524a]">
                  <span><StorefrontText id="copy_cc32cccb2fe12ea8" fallback="Order Items:" /></span>
                  <span>₹{orderAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[#166534] font-semibold">
                  <span><StorefrontText id="copy_a7cdbd97b6c6ce1c" fallback="⚡ Instant Discount (" />{upi.value}%):</span>
                  <span>−₹{upiDiscount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[#46524a]">
                  <span><StorefrontText id="copy_1dc7345f56225e42" fallback="Delivery (" />{orderAmount >= freeShipThreshold ? "Free" : "Standard"}):</span>
                  <span>{shippingFee === 0 ? "FREE" : `₹${shippingFee}`}</span>
                </div>
                <div className="flex justify-between text-[#46524a]">
                  <span><StorefrontText id="copy_742ae2c4cb5417d4" fallback="COD Handling Fee:" /></span>
                  <span className="text-[#166534] font-semibold"><StorefrontText id="copy_2e3f6c85d26a9b57" fallback="₹0 (Waived)" /></span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#23483a]/20 pt-4 mt-2">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-semibold text-[#526359]"><StorefrontText id="copy_c8c22616e7726305" fallback="Net Payable:" /></span>
                <span className="text-2xl font-serif font-bold text-[#1b382d]">
                  ₹{upiTotal.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="bg-[#e2edd9] text-[#1e4620] text-xs font-medium px-3 py-1.5 rounded text-center"><StorefrontText id="copy_c2f85b9d171b2a1e" fallback="🎉 You save" /> <strong>₹{upiSavingsVsCod.toLocaleString("en-IN")}</strong><StorefrontText id="copy_18ba52eb78229222" fallback="compared to COD!" />
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
              <p className="text-xs text-[#737067] mb-4"><StorefrontText id="copy_8cf364bd1f1ef82d" fallback="Visa, MasterCard, RuPay, 50+ Banks" /></p>

              <div className="space-y-2 text-xs sm:text-sm border-t border-[#e4dfd5] pt-3 mb-4">
                <div className="flex justify-between text-[#46524a]">
                  <span><StorefrontText id="copy_cc32cccb2fe12ea8" fallback="Order Items:" /></span>
                  <span>₹{orderAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[#166534] font-semibold">
                  <span><StorefrontText id="copy_6057b24188e5cd6d" fallback="💳 Instant Discount (" />{card.value}%):</span>
                  <span>−₹{cardDiscount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[#46524a]">
                  <span><StorefrontText id="copy_8c07f3f2b15bb4a7" fallback="Delivery:" /></span>
                  <span>{shippingFee === 0 ? "FREE" : `₹${shippingFee}`}</span>
                </div>
                <div className="flex justify-between text-[#46524a]">
                  <span><StorefrontText id="copy_742ae2c4cb5417d4" fallback="COD Handling Fee:" /></span>
                  <span className="text-[#166534] font-semibold"><StorefrontText id="copy_2e3f6c85d26a9b57" fallback="₹0 (Waived)" /></span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#e4dfd5] pt-4 mt-2">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-semibold text-[#737067]"><StorefrontText id="copy_c8c22616e7726305" fallback="Net Payable:" /></span>
                <span className="text-2xl font-serif font-bold text-[#171713]">
                  ₹{cardTotal.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="bg-[#f5f3ec] text-[#46524a] text-xs font-medium px-3 py-1.5 rounded text-center"><StorefrontText id="copy_1509f561f2416598" fallback="Save" /> <strong>₹{(codTotal - cardTotal).toLocaleString("en-IN")}</strong><StorefrontText id="copy_ede4a466860a1a8d" fallback="vs COD + earn card reward points" />
              </div>
            </div>
          </div>

          {/* Card 3: COD */}
          <div className="rounded-xl p-6 border border-[#d7d5c7] bg-[#fbf8f1] flex flex-col justify-between opacity-90">
            <div>
              <div className="flex items-center gap-2 text-[#5c5950] font-bold text-lg mb-1">
                <Truck className="w-5 h-5 text-[#8c887e]" /><StorefrontText id="copy_3e718c330554c19e" fallback="Cash on Delivery (COD)" />
              </div>
              <p className="text-xs text-[#737067] mb-4"><StorefrontText id="copy_c66ff10feca2def2" fallback="Pay cash at doorstep on delivery" /></p>

              <div className="space-y-2 text-xs sm:text-sm border-t border-[#e4dfd5] pt-3 mb-4">
                <div className="flex justify-between text-[#46524a]">
                  <span><StorefrontText id="copy_cc32cccb2fe12ea8" fallback="Order Items:" /></span>
                  <span>₹{orderAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[#854d0e]">
                  <span><StorefrontText id="copy_6cbedb508bea113e" fallback="Payment Discount:" /></span>
                  <span className="font-medium"><StorefrontText id="copy_5b4f54ed7301b12b" fallback="₹0 (No Discount)" /></span>
                </div>
                <div className="flex justify-between text-[#46524a]">
                  <span><StorefrontText id="copy_8c07f3f2b15bb4a7" fallback="Delivery:" /></span>
                  <span>{shippingFee === 0 ? "FREE" : `₹${shippingFee}`}</span>
                </div>
                <div className="flex justify-between text-[#991b1b] font-medium">
                  <span><StorefrontText id="copy_21905fcba654ac2f" fallback="COD Handling Surcharge:" /></span>
                  <span>+₹{codFeeRupees}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#e4dfd5] pt-4 mt-2">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-semibold text-[#737067]"><StorefrontText id="copy_c8c22616e7726305" fallback="Net Payable:" /></span>
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
          <h2 className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal mt-1"><StorefrontText id="copy_7fe1df0349659a76" fallback="Why do we give upfront discounts on prepaid payments?" />
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-[#d7d5c7] bg-white space-y-4">
            <div className="w-10 h-10 rounded-lg bg-[#eef0e7] flex items-center justify-center text-[#23483a]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-[#171713]"><StorefrontText id="copy_50fcfeb4a7165a0d" fallback="100% Surcharge Savings Returned to You" /></h3>
            <p className="text-sm text-[#46524a] leading-relaxed"><StorefrontText id="copy_02559481d748fa70" fallback="Third-party courier companies charge merchants significant cash handling fees, transit insurance surcharges, and high return-to-origin (RTO) penalties on unaccepted COD parcels. When you pay upfront with UPI or cards, those risks disappear completely. Instead of pocketing the savings, we return them directly to you as instant discounts." />
            </p>
          </div>

          <div className="p-6 rounded-xl border border-[#d7d5c7] bg-white space-y-4">
            <div className="w-10 h-10 rounded-lg bg-[#eef0e7] flex items-center justify-center text-[#23483a]">
              <Zap className="w-5 h-5 text-[#b39156]" />
            </div>
            <h3 className="text-lg font-semibold text-[#171713]">Priority Packaging &amp; Instant Dispatch</h3>
            <p className="text-sm text-[#46524a] leading-relaxed"><StorefrontText id="copy_958e8222e97709e5" fallback="Prepaid parcels bypass manual phone verification queues and enter our automated packaging stream immediately at our Siliguri origin hub. Vacuum-sealed tins and foil pouches are packed and handed to premium air-express couriers within 24 hours of ordering." />
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
          <p className="text-sm text-[#46524a] mt-1"><StorefrontText id="copy_41c0954159edb334" fallback="All electronic transactions are processed through Razorpay’s RBI-authorized 256-bit SSL encrypted payment gateway." />
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
                  {upi.value}<StorefrontText id="copy_d892cb05720ec3ad" fallback="% OFF" />
                </span>
              </div>
              <h3 className="font-semibold text-base text-[#171713]">UPI &amp; QR Code</h3>
              <p className="text-xs text-[#737067] mt-1 mb-3"><StorefrontText id="copy_894a8000bce7b2a0" fallback="Instant mobile app authorization" /></p>
              <ul className="text-xs text-[#46524a] space-y-1.5 mb-4">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /><StorefrontText id="copy_f83a3b1268025e8f" fallback="Google Pay, PhonePe, Paytm" />
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /><StorefrontText id="copy_efabb932d826641d" fallback="CRED UPI, BHIM, WhatsApp Pay" />
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /><StorefrontText id="copy_4169d1689769c815" fallback="Instant dynamic QR scan on desktop" />
                </li>
              </ul>
            </div>
            <div className="text-[11px] text-[#526359] border-t border-[#f0ede6] pt-2"><StorefrontText id="copy_61db7731cf78c78b" fallback="Instant refunds processed within minutes if cancelled." />
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
                  {card.value}<StorefrontText id="copy_d892cb05720ec3ad" fallback="% OFF" />
                </span>
              </div>
              <h3 className="font-semibold text-base text-[#171713]">Credit &amp; Debit Cards</h3>
              <p className="text-xs text-[#737067] mt-1 mb-3">Domestic &amp; International</p>
              <ul className="text-xs text-[#46524a] space-y-1.5 mb-4">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /><StorefrontText id="copy_06e06298af812e63" fallback="Visa, MasterCard, RuPay" />
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /><StorefrontText id="copy_f3959478f757c0f8" fallback="American Express, Diners Club" />
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /><StorefrontText id="copy_1bd035478914e7de" fallback="RBI Tokenization Compliant" />
                </li>
              </ul>
            </div>
            <div className="text-[11px] text-[#526359] border-t border-[#f0ede6] pt-2"><StorefrontText id="copy_0055645db90cf62c" fallback="Earn card rewards while enjoying instant store discount." />
            </div>
          </div>

          {/* Method 3: Netbanking & Wallets */}
          <div className="p-5 rounded-xl border border-[#d7d5c7] bg-white flex flex-col justify-between hover:border-[#23483a] transition-colors">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="p-2 rounded-lg bg-[#f5f3ec] text-[#46524a]">
                  <Building2 className="w-5 h-5" />
                </span>
                <span className="text-xs font-medium text-[#46524a] bg-[#f0ede6] px-2 py-0.5 rounded"><StorefrontText id="copy_74cbf6c4ab8875ab" fallback="50+ Banks" />
                </span>
              </div>
              <h3 className="font-semibold text-base text-[#171713]">Net Banking &amp; Wallets</h3>
              <p className="text-xs text-[#737067] mt-1 mb-3"><StorefrontText id="copy_7bf03568503475d5" fallback="Direct account transfer" /></p>
              <ul className="text-xs text-[#46524a] space-y-1.5 mb-4">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /><StorefrontText id="copy_710f07b4554e3b85" fallback="HDFC, ICICI, SBI, Axis, Kotak" />
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /><StorefrontText id="copy_8ac62f464b77b478" fallback="Paytm Wallet, PhonePe Wallet" />
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" /><StorefrontText id="copy_2e3e2b6b8ad0680f" fallback="MobiKwik, Amazon Pay" />
                </li>
              </ul>
            </div>
            <div className="text-[11px] text-[#526359] border-t border-[#f0ede6] pt-2"><StorefrontText id="copy_63fe55adf182dd1d" fallback="Zero surcharge on major Indian banking gateways." />
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
                  +₹{codFeeRupees}<StorefrontText id="copy_f842c3e1858df8c8" fallback="Fee" />
                </span>
              </div>
              <h3 className="font-semibold text-base text-[#171713]"><StorefrontText id="copy_f68cae27c6afa352" fallback="Cash on Delivery" /></h3>
              <p className="text-xs text-[#737067] mt-1 mb-3"><StorefrontText id="copy_84a4298bd202e3b9" fallback="Pay cash upon parcel delivery" /></p>
              <ul className="text-xs text-[#5c5950] space-y-1.5 mb-4">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#737067]" /><StorefrontText id="copy_28615e9c3a6b748c" fallback="19,000+ Indian PIN codes" />
                </li>
                <li className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-[#b91c1c]" /><StorefrontText id="copy_c661136930cf503e" fallback="No payment method discount" />
                </li>
                <li className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-[#b91c1c]" /><StorefrontText id="copy_af7ee82ceac33a97" fallback="Manual phone verification call" />
                </li>
              </ul>
            </div>
            <div className="text-[11px] text-[#8c887e] border-t border-[#eae6db] pt-2"><StorefrontText id="copy_1c5059c0b9f27deb" fallback="Must provide exact change to courier agent at delivery." />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Shipping & Free Delivery Threshold Rule */}
      <section className="p-6 sm:p-8 rounded-xl bg-[#23483a] text-white space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#d7c49e]"><StorefrontText id="copy_baf45a0a0a38ea8f" fallback="Direct From Origin Hub" />
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-normal"><StorefrontText id="copy_b9e3cacb4442ea9d" fallback="Free Delivery on orders above ₹" />{freeShipThreshold}
            </h2>
            <p className="text-sm text-[#e4ede7] max-w-xl"><StorefrontText id="copy_81ce85f6d720760e" fallback="Orders of ₹" />{freeShipThreshold}<StorefrontText id="copy_342178f224b993d2" fallback="or more qualify for complimentary nationwide shipping. For smaller orders under ₹" />{freeShipThreshold}<StorefrontText id="copy_dda81aad5dc1720b" fallback=", a nominal flat transit fee of ₹" />{flatShippingRupees}<StorefrontText id="copy_cfa357678a48f2a6" fallback="is applied." />
            </p>
          </div>
          <div className="flex-shrink-0">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#b39156] hover:bg-[#c2a064] text-[#171713] font-semibold text-sm transition-colors"
            ><StorefrontText id="copy_f2f7901853d4e693" fallback="Shop Fresh Teas" />
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/20 pt-6 text-xs text-[#e4ede7]">
          <div>
            <strong className="block text-white text-sm font-semibold mb-1"><StorefrontText id="copy_6fc63a61944ff633" fallback="Dispatch Commitment" /></strong>
            {data.shipping.dispatchCommitment || "Dispatched within 24–48 hours of lot grading"}
          </div>
          <div>
            <strong className="block text-white text-sm font-semibold mb-1"><StorefrontText id="copy_99b857d7ae1dde40" fallback="Air Express Couriers" /></strong>
            Blue Dart, Delhivery, Shadowfax &amp; DTDC air cargo
          </div>
          <div>
            <strong className="block text-white text-sm font-semibold mb-1"><StorefrontText id="copy_4ab91844e59405a1" fallback="Origin Facility" /></strong><StorefrontText id="copy_4e62dd9f5efe31b8" fallback="Vacuum-sealed at our Siliguri sorting hub, West Bengal" />
          </div>
        </div>
      </section>

      {/* SECTION 5: Frequently Asked Questions (Accessible Details/Summary) */}
      <section className="space-y-6" aria-labelledby="faq-heading">
        <div>
          <h2 id="faq-heading" className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal"><StorefrontText id="copy_a3d458e1bd1eda06" fallback="Frequently Asked Questions" />
          </h2>
          <p className="text-sm text-[#46524a] mt-1"><StorefrontText id="copy_1f1e962c14261e3b" fallback="Everything you need to know about payment security, discounts, and order processing." />
          </p>
        </div>

        <div className="space-y-4">
          <details className="group border border-[#d7d5c7] rounded-xl bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-base text-[#171713]">
              <span><StorefrontText id="copy_4daea2f57429ae2d" fallback="How is the UPI / prepaid discount applied at checkout?" /></span>
              <span className="transition group-open:rotate-180 text-[#737067]">▼</span>
            </summary>
            <p className="mt-3 text-sm text-[#46524a] leading-relaxed"><StorefrontText id="copy_811c47e06363ac6c" fallback="When you select UPI or Credit/Debit Card during checkout, our pricing engine automatically deducts the instant discount (" />{upi.value}<StorefrontText id="copy_69398d5eb538b6b4" fallback="% for UPI," /> {card.value}<StorefrontText id="copy_e54eefb7c8672541" fallback="% for Cards) from your merchandise total before computing the final payable amount. There are no promo codes to type or scratch cards to wait for—the discount is instant and transparently itemized." />
            </p>
          </details>

          <details className="group border border-[#d7d5c7] rounded-xl bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-base text-[#171713]">
              <span><StorefrontText id="copy_1bd98b09a62cd45d" fallback="Is my payment secure on Teafloww?" /></span>
              <span className="transition group-open:rotate-180 text-[#737067]">▼</span>
            </summary>
            <p className="mt-3 text-sm text-[#46524a] leading-relaxed"><StorefrontText id="copy_b63f9f28c7bd9cff" fallback="Yes, 100%. Teafloww uses Razorpay, India’s leading RBI-licensed payment gateway. Your financial credentials never touch our servers. All transactions use 256-bit AES encryption and mandatory two-factor authentication (OTP / UPI PIN) per RBI guidelines." />
            </p>
          </details>

          <details className="group border border-[#d7d5c7] rounded-xl bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-base text-[#171713]">
              <span><StorefrontText id="copy_ffaa9953285eec5f" fallback="What happens if an online payment fails or money is debited?" /></span>
              <span className="transition group-open:rotate-180 text-[#737067]">▼</span>
            </summary>
            <p className="mt-3 text-sm text-[#46524a] leading-relaxed"><StorefrontText id="copy_6428048c78115179" fallback="If a payment fails due to a bank timeout, any debited amount is automatically reversed back to your original payment source by the banking network within 24 to 48 banking hours. Our server verifies every payment webhook independently before completing order reserves." />
            </p>
          </details>

          <details className="group border border-[#d7d5c7] rounded-xl bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-base text-[#171713]">
              <span><StorefrontText id="copy_d3b86785219d94fe" fallback="Can I choose Cash on Delivery for trial packs or special blends?" /></span>
              <span className="transition group-open:rotate-180 text-[#737067]">▼</span>
            </summary>
            <p className="mt-3 text-sm text-[#46524a] leading-relaxed"><StorefrontText id="copy_cbb61261bc910e01" fallback="Cash on Delivery is available across 19,000+ Indian PIN codes for standard catalog teas. However, special trial packs (which are already subsidized for discovery) and custom Blend Lab atelier creations require prepaid confirmation due to their custom-crafted nature." />
            </p>
          </details>

          <details className="group border border-[#d7d5c7] rounded-xl bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between cursor-pointer font-semibold text-base text-[#171713]">
              <span><StorefrontText id="copy_13ee20aa6b8cd167" fallback="Why is there a ₹" />{codFeeRupees}<StorefrontText id="copy_19705fa79c19d6d7" fallback="handling fee on COD orders?" /></span>
              <span className="transition group-open:rotate-180 text-[#737067]">▼</span>
            </summary>
            <p className="mt-3 text-sm text-[#46524a] leading-relaxed"><StorefrontText id="copy_353e5b0afed75ce0" fallback="Courier logistics partners charge a dedicated cash collection and remittance surcharge of ₹50+ per parcel to cover cash handling risk, armed van transfers, and physical receipting. We display this fee transparently rather than inflating tea prices across the board." />
            </p>
          </details>
        </div>
      </section>

      {/* SECTION 6: Bottom Hero Call to Action */}
      <section className="text-center py-12 px-6 rounded-2xl bg-[#f5f3ec] border border-[#d7d5c7] space-y-4">
        <h2 className="text-2xl sm:text-3xl font-serif text-[#171713] font-normal"><StorefrontText id="copy_eee5c6411ded6c39" fallback="Taste Himalayan Teas at Origin Prices" />
        </h2>
        <p className="text-sm sm:text-base text-[#46524a] max-w-xl mx-auto"><StorefrontText id="copy_562cfa440e999230" fallback="Explore single-estate first flush Darjeelings, golden-tippy Assams, and rare high-elevation greens. Pay prepaid to claim your instant discount." />
        </p>
        <div className="pt-2">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-[#23483a] hover:bg-[#1a382d] text-white font-semibold text-sm transition-colors shadow-sm"
          ><StorefrontText id="copy_33a6f9d1a6db95fa" fallback="Explore the Tea Collection" />
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
