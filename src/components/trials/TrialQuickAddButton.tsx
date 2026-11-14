"use client";

import React, { useState } from "react";
import { Zap } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { useRouter } from "next/navigation";

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
  const { buyNow } = useCart();
  const router = useRouter();
  const [buying, setBuying] = useState(false);

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || buying) return;
    setBuying(true);
    buyNow({
      variantId: 0,
      trialId,
      sku,
      slug,
      name: title,
      grams,
      pricePaise,
      imageUrl,
    });
    router.push("/checkout");
  };

  return (
    <button
      type="button"
      onClick={handleBuyNow}
      disabled={disabled || buying}
      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-[#e5b869] hover:bg-[#d4a555] text-[#1a140f] text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shadow-sm hover:shadow active:scale-95"
      aria-label={`Buy ${title} now · Direct checkout`}
      title="Buy Discovery Kit · Instant Checkout"
    >
      <Zap size={13} className="fill-[#1a140f]" aria-hidden="true" />
      <span>{buying ? "Checkout…" : "Buy Now"}</span>
    </button>
  );
}
