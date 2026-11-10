"use client";

import { SubscribeLink } from "@/components/subscriptions/SubscribeLink";
import React, { useState } from "react";
import Image from "next/image";
import type { TrialPublicDto } from "@/lib/trials/types";
import { formatINR } from "@/lib/trials/storefront-helpers";
import { useCart } from "@/components/CartProvider";
import { Check, AlertCircle, Loader2 } from "lucide-react";

export interface TrialBuyBoxProps {
  trial: TrialPublicDto;
}

export function TrialBuyBox({ trial }: TrialBuyBoxProps) {
  const { add } = useCart();
  const [pincode, setPincode] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [shippingMessage, setShippingMessage] = useState<string>("");
  const [added, setAdded] = useState(false);

  const priceRupees = formatINR(trial.price_paise, true);
  const comparePrice = trial.compare_at_price_paise
    ? formatINR(trial.compare_at_price_paise, true)
    : null;

  const handleAddToCart = () => {
    add({
      variantId: 0,
      trialId: trial.id,
      sku: trial.sku,
      slug: trial.slug,
      name: trial.title,
      grams: trial.net_weight_g || 200,
      pricePaise: trial.price_paise,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
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
        <span className="inline-block bg-[#33261e] text-[#edd09e] border border-[#704d30] rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide">
          DISCOVERY KIT · 200G
        </span>
        {trial.in_stock ? (
          <span className="bg-[#1b4332] text-[#86efac] border border-[#2d6a4f] rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            In Stock
          </span>
        ) : (
          <span className="bg-[#4a1515] text-[#fca5a5] border border-[#7f1d1d] rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Sold Out
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
      <div className="my-5 flex items-baseline gap-3">
        <span className="price text-[36px] sm:text-[42px] font-extrabold text-[#e5b869] tracking-tight">
          {priceRupees}
        </span>
        {comparePrice && (
          <span className="text-[16px] text-[#8c745f] line-through">
            {comparePrice}
          </span>
        )}
        <span className="text-[11px] text-[#bda996]">+ delivery at checkout</span>
      </div>

      {/* 4x50g Inclusions List */}
      <div className="inclusions my-5 bg-[#130f0d] border border-[#ffffff10] rounded-xl p-4">
        <div className="text-[10px] uppercase font-bold tracking-[0.16em] text-[#d59e5b] mb-2 pb-1 border-b border-[#ffffff10]">
          PACKAGE INCLUSIONS (200G TOTAL)
        </div>
        {(trial.components || []).map((c, idx) => (
          <div
            key={idx}
            className="flex justify-between items-center py-2 border-b border-[#ffffff10] text-[12px] last:border-none"
          >
            <strong className="text-white font-normal">{c.name}</strong>
            <span className="text-[#ccb59e] font-mono">{c.weight_g}g × 1</span>
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
            <span>Check</span>
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

      {/* Add To Cart CTA Button */}
      <button
        type="button"
        data-testid="add-to-cart-btn"
        disabled={!trial.in_stock}
        onClick={handleAddToCart}
        className={`w-full min-h-[50px] px-6 py-3.5 rounded-xl font-extrabold text-[13px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg active:scale-98 ${
          added
            ? "bg-[#287455] text-white border border-[#48a37d]"
            : trial.in_stock
            ? "bg-gradient-to-r from-[#e4b56e] to-[#bb7c44] text-[#1d1b17] border border-[#f6ca86] hover:opacity-95"
            : "bg-[#33261e] text-[#8c745f] border border-[#544537] cursor-not-allowed"
        }`}
      >
        {added ? (
          <span>Added to Cart ✓</span>
        ) : trial.in_stock ? (
          <span>Order Discovery Kit ({priceRupees}) ↗</span>
        ) : (
          <span>Sold Out</span>
        )}
      </button>

      <div className="mt-3 text-center text-[#bea88e] text-[11px]">
        Includes 4 nitrogen-flushed 50g pouches with estate invoice traceability.
      </div>
      {trial.in_stock && <SubscribeLink trialId={trial.id} />}
    </div>
  );
}
