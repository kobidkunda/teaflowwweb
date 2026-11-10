"use client";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { useDisplayMoney } from "@/components/international/InternationalProvider";

import React, { useState, useEffect } from "react";
import { useCart } from "@/components/CartProvider";

import type { Product, Variant, PackagingFormat } from "@/lib/products";

export interface StickyPurchaseBarProps {
  product: Product;
  activeVariant?: Variant;
  targetSelector?: string;
  forceVisible?: boolean;
  className?: string;
}

const FORMAT_LABELS: Record<PackagingFormat, string> = {
  loose_leaf_pouch: "Loose Leaf",
  luxury_tin: "Luxury Tin",
  pyramid_bags: "Pyramid Bags",
};

export function StickyPurchaseBar({
  product,
  activeVariant: propVariant,
  targetSelector = "#pdp-buy-box",
  forceVisible,
  className = "",
}: StickyPurchaseBarProps) {
  const formatINR = useDisplayMoney();
  const formatPerCup = (price: number, servings: number) => formatINR(servings > 0 ? Math.round(price / servings) : 0);

  const { add } = useCart();

  const [currentVariant, setCurrentVariant] = useState<Variant>(
    () => propVariant || product.variants[0]
  );
  const [isVisible, setIsVisible] = useState(Boolean(forceVisible));
  const [added, setAdded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Sync when prop variant changes
  useEffect(() => {
    if (propVariant) {
      setCurrentVariant(propVariant);
    }
  }, [propVariant]);

  // Listen to custom events dispatched by VariantPicker
  useEffect(() => {
    const handleVariantChange = (e: Event) => {
      const customEvent = e as CustomEvent<{
        variant?: Variant;
        format?: PackagingFormat;
        grams?: number;
      }>;
      if (customEvent.detail?.variant) {
        setCurrentVariant(customEvent.detail.variant);
      }
    };

    const handleVariantAdded = (e: Event) => {
      const detail = (e as CustomEvent<{ variantId?: number }>).detail;
      if (detail?.variantId === currentVariant?.id) {
        setAdded(true);
        setTimeout(() => setAdded(false), 2500);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("tea-variant-change", handleVariantChange);
      window.addEventListener("tea-variant-added", handleVariantAdded);
      return () => {
        window.removeEventListener("tea-variant-change", handleVariantChange);
        window.removeEventListener("tea-variant-added", handleVariantAdded);
      };
    }
  }, [currentVariant?.id]);

  // Track hero purchase container via IntersectionObserver
  useEffect(() => {
    if (forceVisible !== undefined) {
      setIsVisible(forceVisible);
      return;
    }

    if (typeof window === "undefined") return;

    const targetEl = document.querySelector(targetSelector);

    const checkVisibility = () => {
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        setIsVisible(rect.bottom <= 200 || rect.top < -150 || window.scrollY > 450);
      } else {
        setIsVisible(window.scrollY > 450);
      }
    };

    window.addEventListener("scroll", checkVisibility, { passive: true });

    let observer: IntersectionObserver | null = null;
    if (targetEl && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => {
          const isPastHero = entry.boundingClientRect.top < -150 || entry.boundingClientRect.bottom <= 200;
          if (isPastHero) {
            setIsVisible(true);
          } else if (entry.isIntersecting && entry.boundingClientRect.top >= 0 && window.scrollY < 300) {
            setIsVisible(false);
          }
        },
        { threshold: [0, 0.25, 0.5, 0.75, 1] }
      );
      observer.observe(targetEl);
    }

    // Initial check
    checkVisibility();

    return () => {
      window.removeEventListener("scroll", checkVisibility);
      observer?.disconnect();
    };
  }, [targetSelector, forceVisible]);

  if (!currentVariant) return null;

  const isSoldOut = currentVariant.stock < 1;
  const servings =
    currentVariant.servings || Math.floor(currentVariant.grams / product.leaf_dose_grams);
  const perCupStr = formatPerCup(currentVariant.price_paise, servings);
  const formatName =
    FORMAT_LABELS[currentVariant.packaging_format] || "Loose Leaf";
  const sizeName =
    currentVariant.grams >= 1000 ? "1kg" : `${currentVariant.grams}g`;

  const handleQuickAdd = () => {
    if (isSoldOut || isAdding) return;
    setIsAdding(true);
    try {
      add({
        variantId: currentVariant.id, sku: currentVariant.sku?.trim() || `HTH-${product.id}-${currentVariant.id}`,
        slug: product.slug,
        name: product.name,
        grams: currentVariant.grams,
        pricePaise: currentVariant.price_paise,
      });
      setAdded(true);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("tea-variant-added", {
            detail: { variantId: currentVariant.id },
          })
        );
      }

      setTimeout(() => {
        setAdded(false);
        setIsAdding(false);
      }, 2500);
    } catch {
      setIsAdding(false);
    }
  };

  return (
    <aside
      data-testid="sticky-purchase-bar"
      aria-label={`Quick purchase bar for ${product.name}`}
      className={`sticky-purchase-bar sticky-bar fixed bottom-0 left-0 right-0 z-40 bg-[#fbf8f1] border-t border-[#d4cec3] shadow-lg transition-all duration-300 ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        visibility: isVisible ? "visible" : "hidden",
        pointerEvents: isVisible ? "auto" : "none",
        transform: isVisible ? "translateY(0)" : "translateY(100%)",
        paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))",
      }}
    >
      <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-4">
        {/* Left Side: Product Details & Active Variant Specification */}
        <div className="min-w-0 flex-1 flex flex-col justify-center pr-2">
          <strong
            className="text-xs sm:text-sm md:text-base font-serif text-[#171713] truncate block"
            title={product.name}
          >
            {product.name}
          </strong>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#5a6655] truncate">
            <span className="font-semibold text-[#1d2a24] truncate">
              {formatName} · {sizeName}
            </span>
            <span>•</span>
            <span className="tabular-nums shrink-0">{perCupStr} <StorefrontText id="copy_78202e66dc768b4b" fallback="/ cup" /> </span>
            {isSoldOut && (
              <>
                <span>•</span>
                <span className="font-bold text-[#8f2f2a] shrink-0"> <StorefrontText id="copy_5b92d3d791c59ae1" fallback="Sold Out" /> </span>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Active Price & Add to Bag CTA Button */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          <div className="text-right">
            <span
              className="sticky-price text-sm sm:text-base md:text-xl font-bold text-[#171713] tabular-nums block"
              data-testid="sticky-price"
            >
              {formatINR(currentVariant.price_paise)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[#697a55] hidden sm:block">
              {currentVariant.stock > 0 ? "In Stock" : "Out of Stock"}
            </span>
          </div>

          <button
            type="button"
            className="button button-primary shrink-0 px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold tracking-wide whitespace-nowrap"
            disabled={isSoldOut || isAdding}
            aria-disabled={isSoldOut || isAdding}
            onClick={handleQuickAdd}
            style={{
              minHeight: "44px",
              outlineColor: "#a66a43",
            }}
          >
            {isSoldOut
              ? "Sold Out"
              : added
                ? "Added ✓"
                : isAdding
                  ? "Adding..."
                  : "Add to Bag"}
          </button>
        </div>
      </div>
    </aside>
  );
}
