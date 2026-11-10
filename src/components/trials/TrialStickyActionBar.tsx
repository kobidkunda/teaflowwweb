"use client";

import React, { useState } from "react";
import type { TrialPublicDto } from "@/lib/trials/types";
import { formatINR } from "@/lib/trials/storefront-helpers";
import { useCart } from "@/components/CartProvider";

export interface TrialStickyActionBarProps {
  trial: TrialPublicDto;
}

export function TrialStickyActionBar({ trial }: TrialStickyActionBarProps) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  const priceRupees = formatINR(trial.price_paise, true);

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

  return (
    <aside
      data-testid="sticky-trial-buy-box"
      aria-label="Sticky purchase bar"
      className="sticky-trial-bar md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0b0a] text-white border-t border-[#ffffff20] px-4 py-3 pb-safe shadow-[0_-10px_25px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3"
      style={{
        paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
      }}
    >
      <div className="min-w-0 flex-1">
        <small className="block text-[11px] text-[#d0ba9f] truncate">
          {trial.title}
        </small>
        <div className="flex items-baseline gap-1.5">
          <strong className="text-[20px] font-serif font-bold text-[#e5b869]">
            {priceRupees}
          </strong>
          <small className="text-[10px] text-[#a89a8e]">+ delivery</small>
        </div>
      </div>

      <button
        type="button"
        data-testid="sticky-add-to-cart-btn"
        disabled={!trial.in_stock}
        onClick={handleAddToCart}
        className={`sticky-buy-btn min-h-[44px] min-w-[130px] px-4 py-2.5 rounded-xl font-extrabold text-[12px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
          added
            ? "bg-[#287455] text-white border border-[#48a37d]"
            : trial.in_stock
            ? "bg-gradient-to-r from-[#e4b56e] to-[#bb7c44] text-[#1d1b17] shadow-lg border border-[#f6ca86]"
            : "bg-[#33261e] text-[#8c745f] border border-[#544537] cursor-not-allowed"
        }`}
      >
        {added ? (
          <span>Added to Cart ✓</span>
        ) : trial.in_stock ? (
          <span>Order Kit ↗</span>
        ) : (
          <span>Sold Out</span>
        )}
      </button>
    </aside>
  );
}
