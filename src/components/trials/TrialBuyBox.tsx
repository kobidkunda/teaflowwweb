"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { SubscribeLink } from "@/components/subscriptions/SubscribeLink";
import React, { useState } from "react";
import Image from "next/image";
import type { TrialPublicDto } from "@/lib/trials/types";
import { formatINR } from "@/lib/trials/storefront-helpers";
import { useCart } from "@/components/CartProvider";
import { useRouter } from "next/navigation";
import { Check, AlertCircle, Loader2, Zap, Truck, RotateCcw, Star } from "lucide-react";
import type { ClientCommercePolicy } from "@/lib/seo/productPolicy";

export interface TrialBuyBoxProps {
  trial: TrialPublicDto;
  commercePolicy?: ClientCommercePolicy;
}

export function TrialBuyBox({ trial, commercePolicy }: TrialBuyBoxProps) {
  const { add, buyNow } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [pincode, setPincode] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [shippingMessage, setShippingMessage] = useState<string>("");

  const priceRupees = formatINR(trial.price_paise, true);
  const comparePrice = trial.compare_at_price_paise
    ? formatINR(trial.compare_at_price_paise, true)
    : null;

  const handleBuyNow = () => {
    if (!trial.in_stock) return;
    setAdded(true);
    const item = {
      variantId: 0,
      trialId: trial.id,
      sku: trial.sku,
      slug: trial.slug,
      name: trial.title,
      grams: trial.net_weight_g || 200,
      pricePaise: trial.price_paise,
    };
    if (typeof buyNow === "function") {
      buyNow(item);
    }
    if (typeof add === "function") {
      add(item);
    }
    router?.push?.("/checkout");
  };

  const handleCheckPincode = async () => {
    const trimmed = pincode.trim();
    if (!/^[1-9][0-9]{5}$/.test(trimmed)) {
      setPincodeStatus("error");
      setShippingMessage("Enter a valid 6-digit Indian PIN code (cannot start with 0).");
      return;
    }

    setPincodeStatus("loading");
    setShippingMessage("");

    try {
      const res = await fetch(`/api/v1/trials/${trial.slug}/shipping-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pincode: trimmed, quantity: 1 }),
      });

      if (res.ok) {
        const data = await res.json();
        setPincodeStatus("success");
        if (data.shipping_fee_rupees === 0 || data.free_shipping_eligible) {
          setShippingMessage(`Serviceable via ${data.courier_partner || "Courier"}. Free delivery (${data.estimated_days || "2-4 days"}).`);
        } else {
          setShippingMessage(`Serviceable via ${data.courier_partner || "Courier"}. Delivery fee ₹${data.shipping_fee_rupees} (${data.estimated_days || "2-4 days"}).`);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setPincodeStatus("error");
        setShippingMessage(err.error || "Unable to estimate delivery for this PIN code.");
      }
    } catch {
      setPincodeStatus("error");
      setShippingMessage("Network error verifying PIN code. Please try again.");
    }
  };

  return (
    <div className="buybox border border-[#d59e5b5e] rounded-[23px] bg-gradient-to-br from-[#231a16] to-[#16120f] p-6 sm:p-7 shadow-[0_30px_72px_rgba(0,0,0,0.24)] text-[#f7f2eb]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="inline-block bg-[#33261e] text-[#edd09e] border border-[#704d30] rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide"><StorefrontText id="copy_7be3740dc771437a" fallback="DISCOVERY KIT · 200G" />
        </span>
        {trial.in_stock ? (
          <span className="bg-[#1b4332] text-[#86efac] border border-[#2d6a4f] rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"><StorefrontText id="copy_64254d0b795cfb28" fallback="In Stock" />
          </span>
        ) : (
          <span className="bg-[#4a1515] text-[#fca5a5] border border-[#7f1d1d] rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"><StorefrontText id="copy_5b92d3d791c59ae1" fallback="Sold Out" />
          </span>
        )}
      </div>

      <div className="flex gap-4 items-start mb-2">
        {trial.hero_image && (
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden border border-[#5c4231] bg-[#140e0c] shadow-md">
            <Image
              src={trial.hero_image.url}
              alt={trial.hero_image.alt_text || trial.title}
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[26px] sm:text-[34px] leading-[1.12] font-normal mb-1.5 text-[#fffaf1]">
            {trial.title}
          </h1>
          <p className="text-[12px] sm:text-[13px] text-[#b7a89a] leading-relaxed line-clamp-2">
            {trial.tagline || trial.description || "Four craft tea expressions to sample in your kettle."}
          </p>
        </div>
      </div>

      {/* Pricing Row */}
      <div className="my-5 flex items-baseline gap-3 flex-wrap">
        <span className="price text-[36px] sm:text-[42px] font-extrabold text-[#e5b869] tracking-tight">
          {priceRupees}
        </span>
        {comparePrice && (
          <span className="text-[16px] text-[#8c745f] line-through">
            {comparePrice}
          </span>
        )}
        {commercePolicy?.reviewSummary && commercePolicy.reviewSummary.reviewCount > 0 && (
          <a
            href="#verified-reviews"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#edd09e] hover:underline"
          >
            <Star size={13} className="fill-[#e5b869] text-[#e5b869]" aria-hidden="true" />
            <span>{commercePolicy.reviewSummary.ratingValue.toFixed(1)}</span>
            <span className="font-normal text-[#bda996]">({commercePolicy.reviewSummary.reviewCount})</span>
          </a>
        )}
      </div>

      {(() => {
        const freeEligible =
          commercePolicy &&
          !commercePolicy.hasExplicitShippingOverride &&
          commercePolicy.freeShippingEnabled &&
          trial.price_paise >= commercePolicy.freeShippingThresholdPaise;
        const shipPaise = commercePolicy
          ? freeEligible
            ? 0
            : commercePolicy.flatShippingPaise
          : 9900;
        const deliveryLabel = commercePolicy?.deliveryWindowLabel || "3–7 day delivery";
        const returnDays = commercePolicy?.returnWindowDays || 14;
        const shipText =
          shipPaise === 0
            ? "Free delivery"
            : `₹${Math.round(shipPaise / 100)} delivery`;
        return (
          <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#dccab4]">
            <span className="inline-flex items-center gap-1">
              <Truck size={12} aria-hidden="true" />
              <span>{deliveryLabel}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{shipText}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <RotateCcw size={11} aria-hidden="true" />
              <span>{returnDays}-day returns</span>
            </span>
          </div>
        );
      })()}

      {/* 4x50g Inclusions List */}
      <div className="inclusions my-5 bg-[#130f0d] border border-[#ffffff10] rounded-xl p-4">
        <div className="text-[10px] uppercase font-bold tracking-[0.16em] text-[#d59e5b] mb-2 pb-1 border-b border-[#ffffff10]"><StorefrontText id="copy_1ba7ada3d8d46eed" fallback="PACKAGE INCLUSIONS (200G TOTAL)" />
        </div>
        {(trial.components || []).map((c, idx) => (
          <div
            key={idx}
            className="flex justify-between items-center py-2 border-b border-[#ffffff10] text-[12px] last:border-none"
          >
            <strong className="text-white font-normal">{c.name}</strong>
            <span className="text-[#ccb59e] font-mono">{c.weight_g}<StorefrontText id="copy_47a1b260ff58e535" fallback="g × 1" /></span>
          </div>
        ))}
      </div>

      {/* PIN Code Delivery Checker */}
      <div className="my-5">
        <label
          htmlFor="pincode-input"
          className="block text-[11px] uppercase font-bold tracking-wider text-[#deb476] mb-2"
        >
          CHECK DELIVERY & COURIER SERVICE
        </label>
        <div className="flex gap-2">
          <input
            id="pincode-input"
            data-testid="pincode-input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Your 6-digit PIN code"
            aria-label="Enter 6-digit Indian PIN code"
            className="flex-1 min-w-0 border border-[#5c4231] bg-[#120f0d] text-white rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-[#e5b869]"
          />
          <button
            type="button"
            onClick={handleCheckPincode}
            disabled={pincodeStatus === "loading"}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#e5b869] text-[#e5b869] bg-[#ffffff05] hover:bg-[#e5b86915] font-bold text-[12px] transition-all flex items-center gap-1.5"
          >
            {pincodeStatus === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span><StorefrontText id="copy_9d60841e0a7891df" fallback="Check" /></span>
          </button>
        </div>

        {shippingMessage && (
          <div
            className={`mt-2.5 flex items-start gap-1.5 text-[12px] leading-snug ${
              pincodeStatus === "success" ? "text-[#86efac]" : "text-[#fca5a5]"
            }`}
          >
            {pincodeStatus === "success" ? (
              <Check className="w-4 h-4 text-[#86efac] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#fca5a5] shrink-0 mt-0.5" />
            )}
            <span>{shippingMessage}</span>
          </div>
        )}
      </div>

      {/* Buy Now CTA Button */}
      <button
        type="button"
        data-testid="add-to-cart-btn"
        disabled={!trial.in_stock}
        onClick={handleBuyNow}
        className={`w-full min-h-[50px] px-6 py-3.5 rounded-xl font-extrabold text-[14px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg active:scale-98 ${
          added
            ? "bg-[#287455] text-white border border-[#48a37d]"
            : trial.in_stock
            ? "bg-gradient-to-r from-[#e4b56e] to-[#bb7c44] text-[#1d1b17] border border-[#f6ca86] hover:opacity-95 cursor-pointer shadow-[0_4px_20px_rgba(228,181,110,0.35)]"
            : "bg-[#33261e] text-[#8c745f] border border-[#544537] cursor-not-allowed"
        }`}
      >
        {added ? (
          <span><StorefrontText id="copy_2a1082a97808ed6d" fallback="Added to Cart ✓" /></span>
        ) : trial.in_stock ? (
          <>
            <Zap size={16} className="fill-[#1d1b17]" aria-hidden="true" />
            <span>Buy Now · <StorefrontText id="copy_f75bc46676cadf41" fallback="Order Discovery Kit (" />{priceRupees}) ↗</span>
          </>
        ) : (
          <span><StorefrontText id="copy_5b92d3d791c59ae1" fallback="Sold Out" /></span>
        )}
      </button>

      <div className="mt-2.5 text-center text-[#edd09e] text-[11px] font-medium flex items-center justify-center gap-1.5">
        <span aria-hidden="true">⚡</span>
        <span>
          Direct Checkout ·{" "}
          {commercePolicy &&
          !commercePolicy.hasExplicitShippingOverride &&
          commercePolicy.freeShippingEnabled &&
          trial.price_paise >= commercePolicy.freeShippingThresholdPaise
            ? "Free Delivery"
            : commercePolicy?.freeShippingEnabled
            ? `Free delivery on orders ₹${Math.round(commercePolicy.freeShippingThresholdPaise / 100)}+`
            : "Pan-India Dispatch"}
        </span>
      </div>

      <div className="mt-3 text-center text-[#bea88e] text-[11px]"><StorefrontText id="copy_3ceb8432ffe7ae87" fallback="Includes 4 nitrogen-flushed 50g pouches with estate invoice traceability." />
      </div>
      {trial.in_stock && <SubscribeLink trialId={trial.id} />}
    </div>
  );
}
