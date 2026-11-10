"use client";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { useDisplayMoney } from "@/components/international/InternationalProvider";

import React, { useState, useEffect, useCallback } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { useCart } from "@/components/CartProvider";

import {
  getAvailableFormats,
  getAvailableSizesForFormat,
  resolveVariant,
  type Product,
  type Variant,
  type PackagingFormat,
} from "@/lib/productModels";
import { SubscribeLink } from "@/components/subscriptions/SubscribeLink";
import { ShoppingCart, Share2, Check } from "lucide-react";
import { catalogItem, trackViewItem } from "@/lib/seo/tracking";

export interface VariantPickerProps {
  product: Product;
  initialFormat?: PackagingFormat;
  initialGrams?: number;
  onVariantChange?: (variant: Variant) => void;
  className?: string;
}

const FORMAT_LABELS: Record<PackagingFormat, string> = {
  loose_leaf_pouch: "Loose Leaf Pouch",
  luxury_tin: "Luxury Tin",
  pyramid_bags: "Pyramid Tea Bags",
};

export function VariantPicker({
  product,
  initialFormat,
  initialGrams,
  onVariantChange,
  className = "",
}: VariantPickerProps) {
  const formatINR = useDisplayMoney();
  const formatPerCup = (price: number, servings: number) => formatINR(servings > 0 ? Math.round(price / servings) : 0);

  const { add, changeQuantity } = useCart();

  const availableFormats = getAvailableFormats(product.variants);
  const formats: PackagingFormat[] =
    availableFormats.length > 0
      ? availableFormats
      : ["loose_leaf_pouch"];

  const [selectedFormat, setSelectedFormat] = useState<PackagingFormat>(() => {
    if (initialFormat && formats.includes(initialFormat)) {
      return initialFormat;
    }
    return formats[0] || "loose_leaf_pouch";
  });

  const sizesForFormat = getAvailableSizesForFormat(
    product.variants,
    selectedFormat
  );
  const sizes =
    sizesForFormat.length > 0
      ? sizesForFormat
      : product.variants.map((v) => v.grams);

  const [selectedGrams, setSelectedGrams] = useState<number>(() => {
    if (initialGrams && sizes.includes(initialGrams)) {
      return initialGrams;
    }
    if (!initialFormat && product.variants[0]) return product.variants[0].grams;
    return sizes[0] ?? (product.variants[0]?.grams || 100);
  });

  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Resolve current active variant
  const activeVariant =
    resolveVariant(product.variants, selectedFormat, selectedGrams) ||
    product.variants.find((v) => v.packaging_format === selectedFormat) ||
    product.variants[0];

  // Notify listeners and StickyPurchaseBar whenever activeVariant changes
  useEffect(() => {
    if (activeVariant) {
      onVariantChange?.(activeVariant);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("tea-variant-change", {
            detail: {
              variant: activeVariant,
              format: selectedFormat,
              grams: activeVariant.grams,
              product,
            },
          })
        );
      }
      if (activeVariant.id !== product.variants[0]?.id) {
        trackViewItem(catalogItem(product, activeVariant));
      }
    }
  }, [activeVariant, selectedFormat, product, onVariantChange]);

  // Synchronize with external additions (e.g. from StickyPurchaseBar)
  useEffect(() => {
    const handleVariantAdded = (e: Event) => {
      const detail = (e as CustomEvent<{ variantId?: number }>).detail;
      if (detail?.variantId === activeVariant?.id) {
        setAdded(true);
        setTimeout(() => setAdded(false), 2500);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("tea-variant-added", handleVariantAdded);
      return () => {
        window.removeEventListener("tea-variant-added", handleVariantAdded);
      };
    }
  }, [activeVariant?.id]);

  const handleFormatChange = useCallback(
    (fmt: PackagingFormat) => {
      setSelectedFormat(fmt);
      setAdded(false);
      const newSizes = getAvailableSizesForFormat(product.variants, fmt);
      if (newSizes.length > 0) {
        if (!newSizes.includes(selectedGrams)) {
          setSelectedGrams(newSizes[0]);
        }
      }
    },
    [product.variants, selectedGrams]
  );

  const handleSizeChange = useCallback((grams: number) => {
    setSelectedGrams(grams);
    setAdded(false);
  }, []);

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `Discover ${product.name} from Himalayan Tea House.`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    } catch {
      // User cancelled or clipboard not allowed
    }
  };

  if (!activeVariant) {
    return <p className="micro-note"> <StorefrontText id="copy_40739381b20dc03a" fallback="No variants available for this tea." /> </p>;
  }

  const isSoldOut = activeVariant.stock < 1;
  const servings = activeVariant.servings || Math.floor(activeVariant.grams / product.leaf_dose_grams);
  const perCupDisplay = formatPerCup(activeVariant.price_paise, servings);
  const sizeLabel =
    activeVariant.grams >= 1000 ? "1kg" : `${activeVariant.grams}g`;

  const handleAddToBag = () => {
    if (isSoldOut || isAdding) return;
    setIsAdding(true);
    setAddError("");
    try {
      add({
        variantId: activeVariant.id, sku: activeVariant.sku?.trim() || `HTH-${product.id}-${activeVariant.id}`,
        slug: product.slug,
        name: product.name,
        grams: activeVariant.grams,
        pricePaise: activeVariant.price_paise,
      });

      if (quantity > 1) {
        changeQuantity(activeVariant.id, quantity);
      }

      setAdded(true);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("tea-variant-added", {
            detail: { variantId: activeVariant.id },
          })
        );
      }

      setTimeout(() => {
        setAdded(false);
        setIsAdding(false);
      }, 2500);
    } catch {
      setAddError("Unable to add this tea. Please try again.");
      setIsAdding(false);
    }
  };

  return (
    <div
      id="pdp-buy-box"
      className={`purchase-panel ${className}`}
      data-testid="purchase-panel"
      aria-label={`Purchase options for ${product.name}`}
    >
      {/* 1. Rating, Reviews & Share Bar */}
      <div className="flex items-center justify-between gap-4 py-2 border-b border-[#e8e4dc] mb-4 text-xs">

        <button
          type="button"
          onClick={handleShare}
          aria-label="Share tea details"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5a6655] hover:text-[#1b3022] transition-colors"
        >
          <Share2 size={13} aria-hidden="true" />
          <span>{copiedLink ? "Link copied!" : "Share"}</span>
        </button>
      </div>

      {/* 2. Price, Taxes & Live In-Stock Indicator */}
      <div
        className="price-row flex items-baseline justify-between gap-3 mb-1 mt-2"
        style={{ marginTop: "12px", marginBottom: "4px" }}
      >
        <div className="flex items-baseline gap-2">
          <div
            className="price-main"
            data-testid="price-main"
            style={{
              fontVariantNumeric: "tabular-nums",
              fontSize: "34px",
              fontWeight: 700,
              color: "#1b3022",
              lineHeight: 1.1,
            }}
          >
            {formatINR(activeVariant.price_paise)}
          </div>
        </div>

        {/* Stock Badge */}
        <div
          className={`stock-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            isSoldOut ? "out-of-stock" : "in-stock"
          }`}
          style={{
            background: isSoldOut ? "#f7e8e6" : "#eaf3e9",
            color: isSoldOut ? "#8f2f2a" : "#2e683f",
            border: `1px solid ${isSoldOut ? "#dca9a4" : "#b7d6be"}`,
          }}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isSoldOut ? "bg-[#8f2f2a]" : "bg-[#2e683f]"
            }`}
            aria-hidden="true"
          />
          <span>{isSoldOut ? "Sold Out" : "In Stock"}</span>
        </div>
      </div>

      {/* 3. Packaging Format Selector */}
      <div
        className="format-selector mb-4"
        role="group"
        aria-label="Packaging format selection"
        data-testid="format-group"
      >
        <p className="eyebrow text-xs font-bold text-[#555f50] uppercase tracking-wider mb-2"> <StorefrontText id="copy_8a91e5713b814344" fallback="Packaging Format" /> </p>
        <div
          className="variant-grid grid gap-2"
          role="group"
          aria-label="Choose a packaging format"
          style={{
            gridTemplateColumns: `repeat(${Math.min(3, formats.length)}, 1fr)`,
            marginBottom: "14px",
          }}
        >
          {formats.map((fmt) => {
            const isFmtSelected = selectedFormat === fmt;
            return (
              <button
                key={fmt}
                type="button"
                data-format={fmt}
                className={`variant px-3 py-2 text-xs font-semibold rounded-md border text-center transition-all ${
                  isFmtSelected
                    ? "selected active bg-[#1b3022] text-[#fbf8f1] border-[#1b3022] shadow-xs"
                    : "bg-[#fdfbf7] text-[#2c3329] border-[#ded8cb] hover:border-[#96a090]"
                }`}
                aria-pressed={isFmtSelected}
                onClick={() => handleFormatChange(fmt)}
                style={{
                  minHeight: "44px",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <strong>{FORMAT_LABELS[fmt] || fmt}</strong>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Pack Size Selector Cards Grid */}
      <div
        className="size-selector mb-4"
        role="group"
        aria-label={`Choose a size for ${product.name}`}
      >
        <p className="eyebrow text-xs font-bold text-[#555f50] uppercase tracking-wider mb-2"> <StorefrontText id="copy_65357f21fdcb965e" fallback="Select Pack Size" /> </p>
        <div
          className="variant-grid grid grid-cols-2 sm:grid-cols-4 gap-2.5"
          role="group"
          aria-label={`Available sizes for ${FORMAT_LABELS[selectedFormat]}`}
          style={{ marginBottom: "16px" }}
        >
          {sizes.map((grams) => {
            const v = resolveVariant(product.variants, selectedFormat, grams);
            const sizeSoldOut = !v || v.stock < 1;
            const isSelected = activeVariant.grams === grams;
            const cups = v?.servings || Math.floor(grams / product.leaf_dose_grams);

            const displaySizeTitle =
              grams >= 1000
                ? "1kg"
                : selectedFormat === "pyramid_bags"
                  ? `${v?.servings || 25} Bags (${grams}g)`
                  : `${grams}g`;

            return (
              <button
                key={grams}
                type="button"
                data-testid="variant-size-option"
                data-grams={grams}
                disabled={sizeSoldOut}
                aria-disabled={sizeSoldOut}
                className={`variant relative p-3 rounded-lg border-2 flex flex-col justify-between transition-all text-left ${
                  isSelected
                    ? "selected active border-[#1b3022] bg-[#f8f9f6] shadow-xs"
                    : "border-[#ded9ce] bg-white hover:border-[#a6b1a0]"
                } ${sizeSoldOut ? "sold-out opacity-45 cursor-not-allowed bg-gray-50" : "cursor-pointer"}`}
                aria-pressed={isSelected}
                onClick={() => handleSizeChange(grams)}
                style={{
                  minHeight: "74px",
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <strong className="text-sm font-bold text-[#171713] block">
                    {displaySizeTitle}
                  </strong>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-[#1b3022] text-white flex items-center justify-center shrink-0">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </div>

                <div className="mt-1">
                  <span className="text-sm font-bold text-[#1b3022] tabular-nums block">
                    {v ? formatINR(v.price_paise) : ""}
                  </span>
                  <span className="text-[11px] text-[#6b7367] mt-0.5 block">
                    {sizeSoldOut ? "Sold Out" : `~${cups} cups`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Per-Cup Serving Indicator */}
      <p
        className="price-note"
        data-testid="price-note"
        style={{
          fontVariantNumeric: "tabular-nums",
          margin: "4px 0 16px",
          fontSize: "12px",
          color: "#525a4d",
        }}
      >
        {sizeLabel} <StorefrontText id="copy_93b65c1b11181916" fallback="· Approximately" /> {servings} <StorefrontText id="copy_5fc790d0e5ad6d37" fallback="cups ·" /> {perCupDisplay} <StorefrontText id="copy_fb02ea9db1a972dc" fallback="per cup" /> </p>

      {/* 6. Quantity Stepper & Add to Cart Button Row */}
      <div className="flex items-center flex-wrap sm:flex-nowrap gap-3 mb-6">
        {/* Accessible Quantity Selector Stepper */}
        <div
          className="quantity-stepper flex items-center border border-[#ded8cb] bg-white rounded-md shrink-0 overflow-hidden"
          style={{ minHeight: "52px" }}
        >
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={quantity <= 1 || isSoldOut}
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-11 h-full flex items-center justify-center text-lg font-semibold text-[#1b3022] hover:bg-[#f6f2e9] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            −
          </button>
          <span
            className="w-10 text-center font-bold text-sm tabular-nums text-[#1b3022] select-none"
            aria-label={`Quantity: ${quantity}`}
          >
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={quantity >= 20 || isSoldOut}
            onClick={() => setQuantity(Math.min(20, quantity + 1))}
            className="w-11 h-full flex items-center justify-center text-lg font-semibold text-[#1b3022] hover:bg-[#f6f2e9] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            +
          </button>
        </div>

        {/* Primary Add to Cart Button */}
        <button
          type="button"
          data-testid="add-to-bag-button"
          className="button button-primary add-main flex-grow flex items-center justify-center gap-2.5 rounded-md font-sans text-sm font-semibold tracking-wide transition-all shadow-sm"
          disabled={isSoldOut || isAdding}
          aria-disabled={isSoldOut || isAdding}
          onClick={handleAddToBag}
          style={{
            minHeight: "52px",
            backgroundColor: isSoldOut ? "#8f2f2a" : "#1b3022",
            color: "#ffffff",
          }}
        >
          {isSoldOut ? (
            <span> <StorefrontText id="copy_5b92d3d791c59ae1" fallback="Sold Out" /> </span>
          ) : added ? (
            <span> <StorefrontText id="copy_91cf2b03dd545340" fallback="Added ✓" /> </span>
          ) : isAdding ? (
            <span> <StorefrontText id="copy_913a8849b60dd752" fallback="Adding..." /> </span>
          ) : (
            <>
              <ShoppingCart size={17} aria-hidden="true" />
              <span>{`Add to Bag — ${formatINR(activeVariant.price_paise * quantity)}`}</span>
            </>
          )}
        </button>
      </div>

      {!isSoldOut && <SubscribeLink variantId={activeVariant.id} quantity={quantity} />}
      <p className="pdp-add-status sr-only" role="status">
        {added ? "Added to your bag." : ""}
      </p>
      {addError && <p role="alert" className="micro-note text-[#8f2f2a]">{addError}</p>}

      {/* 8. Demonstration Checkout Notice & B2B Inquiries */}
      <div className="mt-3 pt-2.5 border-t border-[#ede7dc] flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-[#70766a]">
        <span> <StorefrontText id="copy_6aad19d7de1da50f" fallback="Demonstration checkout only. No real payment is collected." /> </span>
        <Link
          href="/wholesale"
          className="text-[#1b3022] hover:underline font-semibold inline-flex items-center gap-1"
        >
          <span>Wholesale &amp; Bulk (5kg+)</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

export default VariantPicker;
