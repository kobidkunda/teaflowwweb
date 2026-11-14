"use client";

import React, { useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
import { useCart } from "@/components/CartProvider";

export function TrialQuickAddButton({
  trialId,
  sku,
  slug,
  title,
  grams,
  pricePaise,
  imageUrl,
  disabled,
}: {
  trialId: string;
  sku: string;
  slug: string;
  title: string;
  grams: number;
  pricePaise: number;
  imageUrl: string | null;
  disabled?: boolean;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    if (disabled) return;
    add(
      {
        variantId: 0,
        trialId,
        sku,
        slug,
        name: title,
        grams,
        pricePaise,
        imageUrl,
      },
      true
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-[#23483a] hover:bg-[#1a382d] text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
      aria-label={`Add ${title} to bag`}
    >
      {added ? (
        <>
          <Check size={14} aria-hidden="true" />
          <span>Added ✓</span>
        </>
      ) : (
        <>
          <ShoppingBag size={14} aria-hidden="true" />
          <span>Add to Bag</span>
        </>
      )}
    </button>
  );
}
