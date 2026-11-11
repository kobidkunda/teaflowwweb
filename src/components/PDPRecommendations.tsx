"use client";

import React, { useState } from "react";
import Image from "next/image";
import { LocalizedLink as Link, Text as StorefrontText, useDisplayMoney } from "@/components/international/InternationalProvider";
import { useCart } from "@/components/CartProvider";
import { ShoppingCart, ArrowRight, Heart, Sparkles, Package } from "lucide-react";
import type { RecommendationItem } from "@/lib/recommendations";

export interface PDPRecommendationsProps {
  items?: RecommendationItem[];
  currentCategory?: string;
  currentTeaName?: string;
}

export function PDPRecommendations({
  items = [],
  currentCategory = "Tea",
  currentTeaName,
}: PDPRecommendationsProps) {
  const { add } = useCart();
  const formatMoney = useDisplayMoney();
  const [filter, setFilter] = useState<"all" | "products" | "samples">("all");
  const [wishlist, setWishlist] = useState<Record<string, boolean>>({});
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [announcement, setAnnouncement] = useState<string>("");

  if (!items || items.length === 0) return null;

  const productItems = items.filter((item) => item.type === "product");
  const sampleItems = items.filter((item) => item.type === "sample");

  const filteredItems =
    filter === "products"
      ? productItems
      : filter === "samples"
      ? sampleItems
      : items;

  const toggleWishlist = (id: string) => {
    setWishlist((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleQuickAdd = (item: RecommendationItem) => {
    if (!item.cartPayload) return;
    add({
      variantId: item.cartPayload.variantId,
      trialId: item.cartPayload.trialId,
      sku: item.cartPayload.sku,
      slug: item.cartPayload.slug,
      name: item.cartPayload.name,
      grams: item.cartPayload.grams,
      pricePaise: item.cartPayload.pricePaise,
    });
    setAddedIds((prev) => ({ ...prev, [item.id]: true }));
    setAnnouncement(`${item.name} added to cart.`);
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [item.id]: false }));
    }, 2500);
  };

  const isMilkChai =
    currentCategory.toLowerCase().includes("chai") ||
    currentCategory.toLowerCase().includes("milk");

  return (
    <section
      className="pdp-recommendations w-full my-16 pt-10 border-t border-[#ded8cb]"
      aria-label="Similar teas and sample recommendations"
      data-testid="pdp-recommendations"
    >
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {/* Header with Title and Narrative Context */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-widest uppercase text-[#23483a] bg-[#eef3ee] px-2 py-0.5 rounded-xs">
              <Sparkles size={12} aria-hidden="true" />
              <StorefrontText id="copy_curated_pairings" fallback="Curated Suggestions" />
            </span>
            {sampleItems.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#63685e]">
                · <StorefrontText id="copy_includes_sample_kits" fallback="Includes Tasting Samples" />
              </span>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold tracking-tight text-[#171713]">
            {isMilkChai ? (
              <StorefrontText
                id="copy_similar_milk_chais"
                fallback="Similar Milk Chais & Discovery Samples"
              />
            ) : (
              <StorefrontText
                id="copy_similar_teas_heading"
                fallback="Similar Harvests & Tasting Samples"
              />
            )}
          </h2>
          <p className="text-sm text-[#5a6655] mt-1 max-w-2xl">
            {isMilkChai ? (
              <StorefrontText
                id="copy_milk_chai_sub"
                fallback="Explore related everyday milk blends or start with a 4-tea discovery sample pack to taste in your own kettle before committing."
              />
            ) : (
              <StorefrontText
                id="copy_similar_teas_sub"
                fallback="Discover related single-estate harvests, or order an authentic multi-tea tasting flight."
              />
            )}
          </p>
        </div>

        {/* Global Catalog Links */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/trials"
            className="inline-flex items-center gap-1 text-xs md:text-sm font-semibold text-[#23483a] hover:text-[#b36b3d] transition-colors"
          >
            <span><StorefrontText id="copy_all_sample_kits" fallback="Sample Kits" /></span>
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
          <span className="text-[#c7c1b5]">|</span>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1 text-xs md:text-sm font-semibold text-[#23483a] hover:text-[#b36b3d] transition-colors"
          >
            <span><StorefrontText id="copy_all_teas" fallback="All Teas" /></span>
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Filter Switcher Tabs (All, Similar Teas, Sample Packs) */}
      {sampleItems.length > 0 && productItems.length > 0 && (
        <div
          className="flex items-center gap-2 mb-6 border-b border-[#ede8df] pb-3"
          role="tablist"
          aria-label="Filter recommendations"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            onClick={() => setFilter("all")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
              filter === "all"
                ? "bg-[#1d2a24] text-white"
                : "bg-[#f4efe4] text-[#555850] hover:bg-[#eae3d5] hover:text-[#171713]"
            }`}
          >
            <StorefrontText id="copy_all_suggestions" fallback="All Suggestions" /> ({items.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "products"}
            onClick={() => setFilter("products")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
              filter === "products"
                ? "bg-[#1d2a24] text-white"
                : "bg-[#f4efe4] text-[#555850] hover:bg-[#eae3d5] hover:text-[#171713]"
            }`}
          >
            <StorefrontText id="copy_filter_similar_teas" fallback="Similar Teas" /> ({productItems.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "samples"}
            onClick={() => setFilter("samples")}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
              filter === "samples"
                ? "bg-[#23483a] text-white"
                : "bg-[#e8f0e9] text-[#23483a] hover:bg-[#dbe7dc]"
            }`}
          >
            <Package size={13} aria-hidden="true" />
            <StorefrontText id="copy_filter_samples" fallback="Tasting Samples" /> ({sampleItems.length})
          </button>
        </div>
      )}

      {/* Grid of Recommended Items */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6"
        data-testid="recommendations-grid"
      >
        {filteredItems.map((item) => {
          const isSample = item.type === "sample";
          const isWishlisted = !!wishlist[item.id];
          const isAdded = !!addedIds[item.id];

          return (
            <article
              key={item.id}
              data-testid={`recommendation-${item.type}`}
              className={`group relative bg-[#fdfbf7] rounded-lg overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md transition-all duration-200 border ${
                isSample
                  ? "border-[#2c4e38]/40 ring-1 ring-[#2c4e38]/15 bg-[#fafcf8]"
                  : "border-[#e2dcd2]"
              }`}
            >
              {/* Top Media Container */}
              <div className="relative aspect-[4/3] bg-[#f4efe4] overflow-hidden flex items-center justify-center">
                {/* Badges Stack */}
                <div className="absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1">
                  <span
                    className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-xs shadow-xs ${
                      isSample
                        ? "bg-[#23483a] text-white"
                        : "bg-[#e9e3d5] text-[#333d34] border border-[#d5cdbe]"
                    }`}
                  >
                    {item.badge}
                  </span>
                </div>

                {/* Wishlist Toggle Button */}
                <button
                  type="button"
                  aria-label={
                    isWishlisted
                      ? `Remove ${item.name} from wishlist`
                      : `Add ${item.name} to wishlist`
                  }
                  onClick={() => toggleWishlist(item.id)}
                  className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isWishlisted
                      ? "bg-white text-[#b36b3d] shadow-sm"
                      : "bg-white/85 text-[#5a6655] hover:bg-white hover:text-[#171713]"
                  }`}
                >
                  <Heart
                    size={15}
                    fill={isWishlisted ? "currentColor" : "none"}
                    strokeWidth={1.7}
                  />
                </button>

                {/* Card Image Link */}
                <Link
                  href={item.href}
                  className="relative w-full h-full block"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
                      loading="lazy"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <svg
                      role="img"
                      aria-label={"Artisanal tea packaging for " + item.name}
                      viewBox="0 0 320 240"
                      width={320}
                      height={240}
                      className="w-full h-full object-cover"
                    >
                      <rect width="320" height="240" fill="#ede9df" />
                      <rect
                        x="70"
                        y="40"
                        width="180"
                        height="160"
                        rx="8"
                        fill="#dfd8cb"
                        stroke="#c9c2b6"
                        strokeWidth="2"
                      />
                      <circle cx="160" cy="120" r="35" fill="#23483a" opacity="0.15" />
                      <path
                        d="M160 95 C172 107 172 133 160 145 C148 133 148 107 160 95 Z"
                        fill="#23483a"
                      />
                    </svg>
                  )}
                </Link>
              </div>

              {/* Card Body Content */}
              <div className="p-4 flex flex-col flex-grow justify-between">
                <div>
                  {/* Eyebrow / Provenance Header */}
                  <div className="flex items-center justify-between gap-1 text-[11px] text-[#5a6655] uppercase tracking-wider mb-1 font-medium">
                    <span className="truncate max-w-[65%]">
                      {isSample
                        ? "Craft Tasting Kit"
                        : item.origin
                        ? item.origin.split(",")[0]
                        : item.category}
                    </span>
                    <span className="font-semibold text-[#23483a] shrink-0 bg-[#eef3ee] px-1.5 py-0.5 rounded text-[10px]">
                      {item.weightDisplay}
                    </span>
                  </div>

                  {/* Title Link */}
                  <Link
                    href={item.href}
                    className="text-base font-serif font-bold text-[#171713] hover:text-[#23483a] transition-colors block line-clamp-2 min-h-[2.8em] leading-snug"
                  >
                    {item.name}
                  </Link>

                  {/* Sample Kit Components OR Tasting Notes */}
                  {isSample && item.sampleComponents && item.sampleComponents.length > 0 ? (
                    <div className="mt-2.5 pt-2 border-t border-[#ede8df]">
                      <p className="text-[11px] font-semibold text-[#23483a] mb-1.5 flex items-center gap-1">
                        <Package size={12} aria-hidden="true" />
                        <StorefrontText id="copy_kit_includes" fallback="Includes 4 teas to taste:" />
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.sampleComponents.slice(0, 4).map((c, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-[#f0ede6] text-[#3e443c] px-1.5 py-0.5 rounded border border-[#dfd9ce] font-medium"
                          >
                            {c.name.split("—")[0].trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[#555850] line-clamp-2 leading-relaxed">
                      {item.tastingNotes}
                    </p>
                  )}
                </div>

                {/* Price and Action Bar */}
                <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-[#ede8df]">
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <strong className="text-base font-bold tabular-nums text-[#171713]">
                        {formatMoney(item.pricePaise)}
                      </strong>
                      {item.compareAtPricePaise && item.compareAtPricePaise > item.pricePaise ? (
                        <del className="text-xs text-[#8b9285] line-through font-medium">
                          {formatMoney(item.compareAtPricePaise)}
                        </del>
                      ) : null}
                    </div>
                    <span className="text-[10px] text-[#7c8276]">
                      {isSample
                        ? "Tasting kit set"
                        : item.inStock
                        ? "Freshly packed"
                        : "Out of stock"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={item.href}
                      className="text-xs font-semibold text-[#23483a] hover:underline px-1.5 py-1"
                      aria-label={`View details for ${item.name}`}
                    >
                      <StorefrontText id="copy_view_link" fallback="View" />
                    </Link>
                    <button
                      type="button"
                      disabled={!item.inStock || !item.cartPayload}
                      aria-label={
                        isAdded
                          ? `${item.name} added to cart`
                          : `Quick add ${item.name} to cart`
                      }
                      onClick={() => handleQuickAdd(item)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                        !item.inStock
                          ? "bg-[#ded8cb] text-[#7c8276] cursor-not-allowed"
                          : isAdded
                          ? "bg-[#2e6244] text-white"
                          : "bg-[#1d2a24] text-white hover:bg-[#2e6244]"
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <span aria-hidden="true">✓</span>
                          <span><StorefrontText id="copy_btn_added" fallback="Added" /></span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={13} aria-hidden="true" />
                          <span>
                            {isSample ? (
                              <StorefrontText id="copy_btn_try_sample" fallback="Try Sample" />
                            ) : (
                              <StorefrontText id="copy_btn_add" fallback="Add" />
                            )}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default PDPRecommendations;
