"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import { useCart } from "@/components/CartProvider";
import { Heart, ShoppingCart, ArrowRight } from "lucide-react";
import { useDisplayMoney } from "@/components/international/InternationalProvider";

interface RecommendedTea {
  id: number;
  slug: string;
  name: string;
  pricePaise: number;
  compareAtPricePaise?: number | null;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  bestseller?: boolean;
}

export interface PDPRecommendationsProps {
  items?: RecommendedTea[];
}

export function PDPRecommendations({ items }: PDPRecommendationsProps = {}) {
  const { add } = useCart();
  const formatMoney = useDisplayMoney();
  const [wishlist, setWishlist] = useState<Record<number, boolean>>({});
  const [addedIds, setAddedIds] = useState<Record<number, boolean>>({});

  const displayItems = items && items.length > 0 ? items : [];
  if (displayItems.length === 0) return null;

  const toggleWishlist = (id: number) => {
    setWishlist((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleQuickAdd = (tea: RecommendedTea) => {
    add({
      variantId: tea.id * 100,
      slug: tea.slug,
      name: tea.name,
      grams: 100,
      pricePaise: tea.pricePaise,
    });
    setAddedIds((prev) => ({ ...prev, [tea.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [tea.id]: false }));
    }, 2000);
  };

  return (
    <section
      className="pdp-recommendations w-full my-16 pt-8 border-t border-[#ded8cb]"
      aria-label="You may also like"
    >
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl md:text-2xl font-serif font-bold tracking-tight text-[#171713] uppercase"> <StorefrontText id="copy_a61c1d625f49b921" fallback="YOU MAY ALSO LIKE" /> </h2>
        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-[#23483a] hover:text-[#b36b3d] transition-colors group"
        >
          <span> <StorefrontText id="copy_026ff28ce6e9e0f4" fallback="View All Teas" /> </span>
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {displayItems.map((tea) => {
          const isWishlisted = !!wishlist[tea.id];
          const isAdded = !!addedIds[tea.id];

          return (
            <div
              key={tea.id}
              className="group relative bg-[#fdfbf7] border border-[#e2dcd2] rounded-lg overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md transition-all duration-200"
            >
              {/* Product Art Container */}
              <div className="relative aspect-[4/3] bg-[#f4efe4] overflow-hidden flex items-center justify-center">
                {tea.bestseller && (
                  <span className="absolute top-2.5 left-2.5 z-10 text-[9px] font-bold tracking-wider uppercase bg-[#b36b3d] text-white px-2 py-0.5 rounded-xs shadow-xs"> <StorefrontText id="copy_54c0ca865a0c43f5" fallback="BESTSELLER" /> </span>
                )}

                {/* Wishlist Heart Toggle */}
                <button
                  type="button"
                  aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  onClick={() => toggleWishlist(tea.id)}
                  className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isWishlisted
                      ? "bg-white text-[#b36b3d] shadow-sm"
                      : "bg-white/80 text-[#5a6655] hover:bg-white hover:text-[#171713]"
                  }`}
                >
                  <Heart
                    size={16}
                    fill={isWishlisted ? "currentColor" : "none"}
                    strokeWidth={1.7}
                  />
                </button>

                <Link
                  href={`/tea/${tea.slug}`}
                  className="relative w-full h-full block"
                >
                  <Image
                    src={tea.imageUrl}
                    alt={tea.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 300px"
                    loading="lazy"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </Link>
              </div>

              {/* Product Meta & Purchase Info */}
              <div className="p-3.5 md:p-4 flex flex-col flex-grow justify-between">
                <div>
                  <Link
                    href={`/tea/${tea.slug}`}
                    className="text-sm md:text-base font-serif font-semibold text-[#171713] hover:text-[#23483a] transition-colors block line-clamp-2 min-h-[2.6em] h-[2.6em] overflow-hidden"
                  >
                    {tea.name}
                  </Link>

                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#5a6655]">
                    <span className="text-[#b37d36] font-bold" aria-hidden="true">
                      ★
                    </span>
                    <span className="font-semibold text-[#171713]">
                      {tea.rating}
                    </span>
                    <span className="text-[#7c8276]">
                      ({tea.reviewCount})
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-[#ede8df]">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <strong className="text-sm md:text-base font-bold tabular-nums text-[#171713]">
                      {formatMoney(tea.pricePaise)}
                    </strong>
                    {tea.compareAtPricePaise && tea.compareAtPricePaise > tea.pricePaise ? (
                      <>
                        <del
                          className="text-xs text-[#8b9285] line-through font-medium"
                          aria-label={`Original price ${formatMoney(tea.compareAtPricePaise)}`}
                        >
                          {formatMoney(tea.compareAtPricePaise)}
                        </del>
                        <span
                          className="text-[10px] font-bold text-[#1d5f38] bg-[#e8f5ec] border border-[#c3e5cd] px-1.5 py-0.5 rounded-xs"
                          aria-label={`${Math.round(((tea.compareAtPricePaise - tea.pricePaise) / tea.compareAtPricePaise) * 100)} percent off`}
                        >
                          {Math.round(((tea.compareAtPricePaise - tea.pricePaise) / tea.compareAtPricePaise) * 100)} <StorefrontText id="copy_d892cb05720ec3ad" fallback="% OFF" /> </span>
                      </>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    aria-label={`Quick add ${tea.name} to cart`}
                    onClick={() => handleQuickAdd(tea)}
                    className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${
                      isAdded
                        ? "bg-[#2e6244] text-white"
                        : "bg-[#1d2a24] text-white hover:bg-[#2e6244]"
                    }`}
                  >
                    {isAdded ? (
                      <span className="text-xs font-bold">✓</span>
                    ) : (
                      <ShoppingCart size={15} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default PDPRecommendations;
