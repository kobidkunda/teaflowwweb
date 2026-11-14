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
import { formatPackWeight } from "@/lib/packSize";
import { ShoppingCart, Share2, Check, Zap, MapPin, Truck } from "lucide-react";
import { catalogItem, trackViewItem } from "@/lib/seo/tracking";
import { cupsFromGrams } from "@/lib/money";

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

  const { add, subtotal: cartSubtotal } = useCart();
  const [pincode, setPincode] = useState("");
  const [pincodeResult, setPincodeResult] = useState<{ status: "idle" | "ok" | "error"; text: string }>({
    status: "idle",
    text: "",
  });

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

  const [purchaseMode, setPurchaseMode] = useState<"retail" | "wholesale">("retail");
  const isWholesaleMode = purchaseMode === "wholesale";
  const isBulkSackSelected = (activeVariant?.grams ?? selectedGrams) >= 5000;
  const effectiveMoq = isBulkSackSelected ? 1 : (product.wholesale_moq || 50);

  const retailSizes = sizes.filter((g) => g <= 1000);
  const bulkSizes = sizes.filter((g) => g >= 5000);
  const visibleSizes =
    !isWholesaleMode && retailSizes.length > 0
      ? retailSizes
      : isWholesaleMode && bulkSizes.length > 0
      ? sizes.filter((g) => g >= 1000 || (resolveVariant(product.variants, selectedFormat, g)?.wholesale_slabs?.length ?? 0) > 0)
      : sizes;

  const oneKgVariant = resolveVariant(product.variants, selectedFormat, 1000) || product.variants.find((v) => v.grams === 1000);
  const basePerKgPaise = oneKgVariant ? oneKgVariant.price_paise : 28000;

  const wholesaleSlabs = (activeVariant?.wholesale_slabs || [])
    .slice()
    .sort((a, b) => a.min_qty - b.min_qty);

  let activeWholesaleUnitPaise = activeVariant?.price_paise ?? 19900;
  if (wholesaleSlabs.length > 0) {
    const matching = wholesaleSlabs.filter((s) => quantity >= s.min_qty);
    if (matching.length > 0) {
      activeWholesaleUnitPaise = matching[matching.length - 1].price_paise;
    } else {
      activeWholesaleUnitPaise = wholesaleSlabs[0].price_paise;
    }
  }

  const regularUnitPaise = activeVariant?.price_paise ?? 19900;
  const currentUnitPaise = isWholesaleMode ? activeWholesaleUnitPaise : regularUnitPaise;
  const totalPricePaise = currentUnitPaise * quantity;
  const bulkBenchmarkPaise =
    isBulkSackSelected && activeVariant
      ? Math.round((activeVariant.grams / 1000) * basePerKgPaise)
      : regularUnitPaise;
  const totalSavingsPaise =
    isWholesaleMode && regularUnitPaise > currentUnitPaise
      ? (regularUnitPaise - currentUnitPaise) * quantity
      : isBulkSackSelected && bulkBenchmarkPaise > currentUnitPaise
      ? (bulkBenchmarkPaise - currentUnitPaise) * quantity
      : 0;
  const savingsPercent =
    isWholesaleMode && regularUnitPaise > currentUnitPaise && regularUnitPaise > 0
      ? Math.round(((regularUnitPaise - currentUnitPaise) / regularUnitPaise) * 100)
      : isBulkSackSelected && bulkBenchmarkPaise > currentUnitPaise && bulkBenchmarkPaise > 0
      ? Math.round(((bulkBenchmarkPaise - currentUnitPaise) / bulkBenchmarkPaise) * 100)
      : 0;

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

  const handleSizeChange = useCallback(
    (grams: number) => {
      setSelectedGrams(grams);
      setAdded(false);
      if (grams >= 5000 && purchaseMode === "wholesale" && quantity >= 50) {
        setQuantity(1);
      } else if (grams < 5000 && purchaseMode === "wholesale" && quantity < (product.wholesale_moq || 50)) {
        setQuantity(product.wholesale_moq || 50);
      }
    },
    [purchaseMode, quantity, product.wholesale_moq]
  );

  const switchMode = useCallback(
    (mode: "retail" | "wholesale") => {
      setPurchaseMode(mode);
      if (mode === "retail") {
        if (selectedGrams > 1000) {
          const retailCandidates = sizes.filter((g) => g <= 1000);
          const target = retailCandidates[0] || 100;
          setSelectedGrams(target);
        }
        if (quantity > 20) setQuantity(1);
      } else {
        const bulkCandidates = sizes.filter((g) => g >= 5000);
        if (bulkCandidates.length > 0 && selectedGrams < 5000) {
          setSelectedGrams(bulkCandidates[0]);
          setQuantity(1);
        } else if (selectedGrams < 5000) {
          const moq = product.wholesale_moq || 50;
          if (quantity < moq) setQuantity(moq);
        }
      }
    },
    [sizes, product.wholesale_moq, quantity, selectedGrams]
  );

  const handleCheckPincode = useCallback(() => {
    const clean = pincode.trim();
    if (!/^[1-9][0-9]{5}$/.test(clean)) {
      setPincodeResult({
        status: "error",
        text: "Please enter a valid 6-digit Indian PIN code (e.g. 734001).",
      });
      return;
    }
    const prefix = Number(clean.slice(0, 2));
    const isEastOrNorthEast = prefix >= 70 && prefix <= 79;
    const days = isEastOrNorthEast ? "2–3 business days" : "3–5 business days";
    const combinedPaise = cartSubtotal + totalPricePaise;
    const freeShipText =
      combinedPaise >= 49900
        ? "FREE Delivery unlocked (orders ₹499+)"
        : `Add ${formatINR(49900 - combinedPaise)} more for FREE Delivery (₹499+ threshold)`;
    const codText =
      combinedPaise >= 29900 || isWholesaleMode
        ? "Cash on Delivery available"
        : `COD available on orders ₹299+`;
    setPincodeResult({
      status: "ok",
      text: `✓ Deliverable to PIN ${clean} in ${days} from Siliguri origin · ${freeShipText} · ${codText}.`,
    });
  }, [pincode, cartSubtotal, totalPricePaise, formatINR, isWholesaleMode]);

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
  const calculatedServings = product.leaf_dose_grams && product.leaf_dose_grams > 0
    ? Math.floor(activeVariant.grams / product.leaf_dose_grams)
    : cupsFromGrams(activeVariant.grams);
  const servings =
    (activeVariant.servings && activeVariant.servings > 50 && activeVariant.servings >= Math.floor(activeVariant.grams / 3))
      ? activeVariant.servings
      : (activeVariant.servings && activeVariant.grams <= 1000)
      ? activeVariant.servings
      : calculatedServings;
  const perCupDisplay = formatPerCup(activeVariant.price_paise, servings);
  const sizeLabel = formatPackWeight(activeVariant.grams);

  const handleAddToBag = () => {
    if (isSoldOut || isAdding) return;
    setIsAdding(true);
    setAddError("");
    try {
      add({
        variantId: activeVariant.id,
        sku: activeVariant.sku?.trim() || `HTH-${product.id}-${activeVariant.id}`,
        slug: product.slug,
        name: product.name + (isWholesaleMode ? " (Wholesale)" : ""),
        grams: activeVariant.grams,
        pricePaise: currentUnitPaise,
        quantity,
        imageUrl: (activeVariant as { product_image_url?: string }).product_image_url || product.primary_image?.url || (product as { primary_image_url?: string }).primary_image_url || null,
        isWholesale: isWholesaleMode,
        wholesaleSlabPrice: isWholesaleMode ? currentUnitPaise : undefined,
        wholesaleMoq: isWholesaleMode ? effectiveMoq : undefined,
      });

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

  const handleBuyNow = () => {
    if (isSoldOut || isAdding) return;
    handleAddToBag();
    if (typeof window !== "undefined") {
      window.location.assign("/checkout");
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
      <div className="flex items-center justify-between gap-4 py-2 border-b border-[#e8e4dc] mb-3 text-xs">
        <span className="font-semibold text-[#5a6655] uppercase tracking-wider text-[11px]"><StorefrontText id="copy_97f19ad6e6888594" fallback="Direct from Estate" /></span>
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

      {/* Mode Switcher: Retail vs Wholesale */}
      <div
        className="purchase-mode-switch flex items-center p-1 bg-[#ede8dc] rounded-lg mb-4"
        role="tablist"
        aria-label="Select buying mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!isWholesaleMode}
          onClick={() => switchMode("retail")}
          className={`flex-1 py-2 text-xs font-bold rounded-md transition-all text-center ${
            !isWholesaleMode
              ? "bg-[#1b3022] text-[#fbf8f1] shadow-xs"
              : "text-[#475244] hover:text-[#1b3022]"
          }`}
        ><StorefrontText id="copy_ba217ba9982e9c30" fallback="☕ Retail Packs" />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isWholesaleMode}
          onClick={() => switchMode("wholesale")}
          className={`flex-1 py-2 text-xs font-bold rounded-md transition-all text-center flex items-center justify-center gap-1.5 ${
            isWholesaleMode
              ? "bg-[#1b3022] text-[#fbf8f1] shadow-xs"
              : "text-[#475244] hover:text-[#1b3022]"
          }`}
        >
          <span><StorefrontText id="copy_67b63fbc26e7e25e" fallback="📦 Buy in Wholesale (Bulk Slabs)" /></span>
          {wholesaleSlabs.length > 0 && (
            <span className="bg-[#e4761b] text-white text-[10px] px-1.5 py-0.2 rounded font-bold"><StorefrontText id="copy_67a9b3f504fe53f9" fallback="Bulk %" />
            </span>
          )}
        </button>
      </div>

      {/* 2. Price, Taxes & Live In-Stock Indicator */}
      <div
        className="price-row flex items-baseline justify-between gap-3 mb-1 mt-1"
        style={{ marginTop: "8px", marginBottom: "4px" }}
      >
        <div className="flex items-baseline gap-2 flex-wrap">
          <div
            className="price-main"
            data-testid="price-main"
            style={{
              fontVariantNumeric: "tabular-nums",
              fontSize: "32px",
              fontWeight: 700,
              color: "#1b3022",
              lineHeight: 1.1,
            }}
          >
            {formatINR(currentUnitPaise)}
          </div>
          {isWholesaleMode && regularUnitPaise > currentUnitPaise && (
            <div className="flex items-center gap-1.5">
              <del className="text-sm text-[#7a8274] font-medium">
                {formatINR(regularUnitPaise)}
              </del>
              <span className="text-xs bg-[#eaf3e9] text-[#2e683f] font-bold px-1.5 py-0.5 rounded">
                {savingsPercent}<StorefrontText id="copy_d892cb05720ec3ad" fallback="% OFF" />
              </span>
            </div>
          )}
          {isWholesaleMode && (
            <span className="text-[11px] font-semibold text-[#5a6655]"><StorefrontText id="copy_94a52947856eeac3" fallback="/ piece" /></span>
          )}
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

      {/* Interactive Wholesale Tier Cards & Freight Notice */}
      {isWholesaleMode && (
        <div className="wholesale-tier-container bg-[#f5f7f2] border border-[#bcd2bf] rounded-lg p-3.5 mb-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#23483a] flex items-center gap-1.5">
              <span><StorefrontText id="copy_8b20d91a650659c7" fallback="📊 Volume Pricing Slabs (" />{sizeLabel})</span>
            </span>
            <span className="text-[11px] font-semibold text-[#5a6655]"><StorefrontText id="copy_492f5a49ed026e3f" fallback="MOQ:" /> {effectiveMoq}<StorefrontText id="copy_d7d4f59db48fb4b8" fallback="pcs" />
            </span>
          </div>

          {wholesaleSlabs.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {wholesaleSlabs.map((slab, sIdx) => {
                const nextSlab = wholesaleSlabs[sIdx + 1];
                const qtyLabel = nextSlab ? `${slab.min_qty}–${nextSlab.min_qty - 1} pcs` : `${slab.min_qty}+ pcs`;
                const isCurrentTier = quantity >= slab.min_qty && (!nextSlab || quantity < nextSlab.min_qty);
                const discount = regularUnitPaise > 0 ? Math.round(((regularUnitPaise - slab.price_paise) / regularUnitPaise) * 100) : 0;

                return (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => setQuantity(slab.min_qty)}
                    className={`p-2.5 rounded-md border text-left transition-all ${
                      isCurrentTier
                        ? "border-[#1b3022] bg-[#ffffff] ring-2 ring-[#2e683f] shadow-sm"
                        : "border-[#d0d9cd] bg-[#ffffff] hover:border-[#8da08b]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#1b3022]">{qtyLabel}</span>
                      {discount > 0 && (
                        <span className="text-[10px] bg-[#eaf3e9] text-[#2e683f] font-bold px-1.5 py-0.2 rounded">
                          {discount}<StorefrontText id="copy_d892cb05720ec3ad" fallback="% OFF" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <del className="text-[11px] text-[#788273]">{formatINR(regularUnitPaise)}</del>
                      <strong className="text-sm font-bold text-[#1b3022]">{formatINR(slab.price_paise)}</strong>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-white p-3 rounded border border-[#d0d9cd] mb-3 text-xs text-[#525e4f]">
              <p className="font-semibold text-[#1b3022] mb-1"><StorefrontText id="copy_f0438b18e0884bae" fallback="Direct Wholesale Lot" /></p>
              <p><StorefrontText id="copy_42e438a7f0bfc6f4" fallback="Wholesale rate applies at" /> {formatINR(currentUnitPaise)}<StorefrontText id="copy_d49bbff900428b77" fallback="/unit for minimum order of" /> {effectiveMoq}<StorefrontText id="copy_47a56c994e81e273" fallback="+ units. Contact our desk for larger container volume rates." /></p>
            </div>
          )}

          {/* Live Total Savings Highlight */}
          {totalSavingsPaise > 0 && (
            <div className="bg-[#e7f3e8] border border-[#a8cda9] text-[#1c4d28] rounded p-2 text-xs font-semibold flex items-center justify-between mb-2">
              <span><StorefrontText id="copy_13c52022e8769c2b" fallback="🎉 Wholesale Slab Savings:" /></span>
              <span><StorefrontText id="copy_5ecc9f79a6f15763" fallback="You save" /> {formatINR(totalSavingsPaise)} ({savingsPercent}<StorefrontText id="copy_32917eeea7da1f45" fallback="% OFF)!" /></span>
            </div>
          )}

          {/* Special Transport Notice Banner */}
          <div className="bg-[#fff9ed] border border-[#eedab2] text-[#7d5615] rounded p-2.5 text-xs flex items-start gap-2">
            <span className="text-base leading-none">🚛</span>
            <div>
              <strong className="block text-[#684407] mb-0.5"><StorefrontText id="copy_2f7584be0f7b1e93" fallback="Commercial Transport Dispatch Notice:" /></strong>
              <span><StorefrontText id="copy_17424fbc405f07f1" fallback="Wholesale goods are dispatched via commercial surface road transport." /> <strong><StorefrontText id="copy_13ae603252609e2a" fallback="Transport / freight charges are extra" /></strong><StorefrontText id="copy_a8dd6b3c335b9d8d" fallback="and payable directly upon cargo delivery (To-Pay Bilty)." /></span>
            </div>
          </div>
        </div>
      )}

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
        <div className="flex items-center justify-between mb-2">
          <p className="eyebrow text-xs font-bold text-[#555f50] uppercase tracking-wider m-0">
            <StorefrontText
              id="copy_65357f21fdcb965e"
              fallback={isWholesaleMode ? "Select Bulk Sack or Wholesale Pack" : "Select Retail Pack Size"}
            />
          </p>
          {!isWholesaleMode && bulkSizes.length > 0 && (
            <button
              type="button"
              onClick={() => switchMode("wholesale")}
              className="text-[11px] font-semibold text-[#23483a] hover:underline cursor-pointer"
            >
              Need 5kg–35kg Bulk Sacks? Save up to 21% →
            </button>
          )}
        </div>
        <div
          className="variant-grid grid grid-cols-2 sm:grid-cols-4 gap-2.5"
          role="group"
          aria-label={`Available sizes for ${FORMAT_LABELS[selectedFormat]}`}
          style={{ marginBottom: "16px" }}
        >
          {visibleSizes.map((grams) => {
            const v = resolveVariant(product.variants, selectedFormat, grams);
            const sizeSoldOut = !v || v.stock < 1;
            const isSelected = activeVariant.grams === grams;
            const calculatedCups = product.leaf_dose_grams && product.leaf_dose_grams > 0
              ? Math.floor(grams / product.leaf_dose_grams)
              : cupsFromGrams(grams);
            const cups = (v?.servings && v.servings > 50 && v.servings >= Math.floor(grams / 3))
              ? v.servings
              : (v?.servings && grams <= 1000)
              ? v.servings
              : calculatedCups;

            const displaySizeTitle =
              selectedFormat === "pyramid_bags" && grams < 1000
                ? `${cups || 25} Bags (${formatPackWeight(grams)})`
                : formatPackWeight(grams);

            const perKgPaise = v && grams >= 1000 ? Math.round((v.price_paise * 1000) / grams) : null;
            const bulkSavePct =
              perKgPaise && basePerKgPaise > perKgPaise
                ? Math.round(((basePerKgPaise - perKgPaise) / basePerKgPaise) * 100)
                : 0;

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
                  minHeight: "78px",
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <div>
                    <strong className="text-sm font-bold text-[#171713] block">
                      {displaySizeTitle}
                    </strong>
                    {grams >= 10000 ? (
                      <span className="text-[10px] text-[#854d0e] font-semibold">Bulk Sack</span>
                    ) : grams >= 5000 ? (
                      <span className="text-[10px] text-[#854d0e] font-semibold">Bulk Pack</span>
                    ) : null}
                  </div>
                  {isSelected ? (
                    <span className="w-4 h-4 rounded-full bg-[#1b3022] text-white flex items-center justify-center shrink-0">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  ) : bulkSavePct > 0 ? (
                    <span className="text-[10px] bg-[#eaf3e9] text-[#2e683f] font-bold px-1.5 py-0.5 rounded">
                      Save {bulkSavePct}%
                    </span>
                  ) : null}
                </div>

                <div className="mt-1">
                  <span className="text-sm font-bold text-[#1b3022] tabular-nums block">
                    {v ? formatINR(v.price_paise) : ""}
                  </span>
                  <span className="text-[11px] text-[#6b7367] mt-0.5 block">
                    {sizeSoldOut
                      ? "Sold Out"
                      : perKgPaise && grams >= 5000
                      ? `${formatINR(perKgPaise)}/kg${bulkSavePct > 0 ? ` · ${bulkSavePct}% off` : ""}`
                      : `~${cups.toLocaleString("en-IN")} cups`}
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

      {/* 6. Quantity Stepper, Add to Bag & Buy Now Row */}
      <div className="flex items-center flex-wrap sm:flex-nowrap gap-2.5 mb-3">
        {/* Accessible Quantity Selector Stepper */}
        {isWholesaleMode && !isBulkSackSelected ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <div
              className="quantity-stepper flex items-center border border-[#bcd2bf] bg-white rounded-md shrink-0 overflow-hidden"
              style={{ minHeight: "52px" }}
            >
              <button
                type="button"
                aria-label="Decrease wholesale quantity by 10"
                disabled={quantity <= effectiveMoq || isSoldOut}
                onClick={() => setQuantity(Math.max(effectiveMoq, quantity - 10))}
                className="w-10 h-full flex items-center justify-center text-sm font-bold text-[#1b3022] hover:bg-[#f6f2e9] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="-10 units"
              >
                −10
              </button>
              <input
                type="number"
                min={effectiveMoq}
                max={10000}
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) setQuantity(Math.max(1, val));
                }}
                onBlur={() => {
                  if (quantity < effectiveMoq) setQuantity(effectiveMoq);
                }}
                className="w-16 text-center font-bold text-sm tabular-nums text-[#1b3022] py-2 border-x border-[#bcd2bf] focus:outline-none"
                aria-label={`Wholesale quantity: ${quantity} units`}
              />
              <button
                type="button"
                aria-label="Increase wholesale quantity by 10"
                disabled={quantity >= 10000 || isSoldOut}
                onClick={() => setQuantity(Math.min(10000, quantity + 10))}
                className="w-10 h-full flex items-center justify-center text-sm font-bold text-[#1b3022] hover:bg-[#f6f2e9] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="+10 units"
              >
                +10
              </button>
            </div>
          </div>
        ) : (
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
              disabled={quantity >= 50 || isSoldOut}
              onClick={() => setQuantity(Math.min(50, quantity + 1))}
              className="w-11 h-full flex items-center justify-center text-lg font-semibold text-[#1b3022] hover:bg-[#f6f2e9] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              +
            </button>
          </div>
        )}

        {/* Primary Add to Cart Button */}
        <button
          type="button"
          data-testid="add-to-bag-button"
          className="button button-primary add-main flex-grow flex items-center justify-center gap-2 rounded-md font-sans text-sm font-semibold tracking-wide transition-all shadow-sm px-4"
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
              <ShoppingCart size={16} aria-hidden="true" />
              <span>{isWholesaleMode ? `Add to Bag (Wholesale) — ${formatINR(totalPricePaise)}` : `Add to Bag — ${formatINR(totalPricePaise)}`}</span>
            </>
          )}
        </button>

        {/* Direct Buy Now Button */}
        {!isSoldOut && (
          <button
            type="button"
            data-testid="buy-now-button"
            onClick={handleBuyNow}
            disabled={isAdding}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-[#1b3022] bg-[#fbf8f1] hover:bg-[#1b3022] text-[#1b3022] hover:text-white font-sans text-sm font-bold px-4 transition-colors shrink-0 cursor-pointer"
            style={{ minHeight: "52px" }}
          >
            <Zap size={15} aria-hidden="true" />
            <span>Buy Now</span>
          </button>
        )}
      </div>

      {/* Upfront Minimum COD Order Helper when selected pack + current bag is under ₹299 */}
      {!isWholesaleMode && !isSoldOut && cartSubtotal + totalPricePaise < 29900 && (
        <div className="mb-3 p-2.5 rounded-lg bg-[#fff8eb] border border-[#f2d6a2] text-xs text-[#7c4d0b] flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>Cash on Delivery minimum is ₹299:</strong> Add{" "}
            <strong>{formatINR(29900 - (cartSubtotal + totalPricePaise))}</strong> more (or choose{" "}
            <strong>1kg at {formatINR(basePerKgPaise)}</strong>) to qualify for COD dispatch.
          </span>
          <button
            type="button"
            onClick={() => {
              const neededPaise = Math.max(0, 29900 - cartSubtotal);
              const targetQty = Math.max(1, Math.ceil(neededPaise / Math.max(1, currentUnitPaise)));
              setQuantity(Math.min(20, targetQty));
            }}
            className="px-2.5 py-1 rounded bg-[#1b3022] text-white font-semibold text-[11px] hover:bg-[#2a4734] transition-colors shrink-0 cursor-pointer"
          >
            Set qty to {Math.max(1, Math.ceil(Math.max(0, 29900 - cartSubtotal) / Math.max(1, currentUnitPaise)))} ({formatINR(Math.max(1, Math.ceil(Math.max(0, 29900 - cartSubtotal) / Math.max(1, currentUnitPaise))) * currentUnitPaise)}) →
          </button>
        </div>
      )}

      {isWholesaleMode && !isBulkSackSelected && (
        <div className="flex items-center gap-2 mb-4 text-xs text-[#525e4f]">
          <span className="font-semibold text-[#1b3022]"><StorefrontText id="copy_b38da506e5346f1b" fallback="Quick Units:" /></span>
          {[effectiveMoq, 100, 250, 500].filter((q) => q >= effectiveMoq).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuantity(q)}
              className={`px-2 py-1 rounded border text-xs font-semibold ${
                quantity === q
                  ? "bg-[#1b3022] text-white border-[#1b3022]"
                  : "bg-white text-[#2a3828] border-[#c4d2c2] hover:border-[#879984]"
              }`}
            >
              {q}<StorefrontText id="copy_d7d4f59db48fb4b8" fallback="pcs" />
            </button>
          ))}
        </div>
      )}

      {!isSoldOut && !isWholesaleMode && <SubscribeLink variantId={activeVariant.id} quantity={quantity} />}
      <p className="pdp-add-status sr-only" role="status">
        {added ? "Added to your bag." : ""}
      </p>
      {addError && <p role="alert" className="micro-note text-[#8f2f2a]">{addError}</p>}

      {/* 7. PIN-Code Delivery & COD Estimator */}
      <div className="mt-3 p-3 rounded-lg bg-[#f7f4ec] border border-[#e3ddd0]">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label htmlFor="pdp-pincode-check" className="text-xs font-bold text-[#1b3022] flex items-center gap-1.5">
            <MapPin size={13} className="text-[#23483a]" aria-hidden="true" />
            <span>Check Delivery &amp; COD Availability</span>
          </label>
          <span className="text-[11px] text-[#556358] flex items-center gap-1">
            <Truck size={12} aria-hidden="true" /> Free delivery ₹499+
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="pdp-pincode-check"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={pincode}
            onChange={(e) => {
              setPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
              if (pincodeResult.status !== "idle") setPincodeResult({ status: "idle", text: "" });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCheckPincode();
              }
            }}
            placeholder="Enter 6-digit PIN code (e.g. 734001)"
            className="flex-1 min-h-[38px] px-3 py-1.5 rounded border border-[#cfc8b8] bg-white text-xs text-[#171713] focus:outline-none focus:border-[#1b3022]"
          />
          <button
            type="button"
            onClick={handleCheckPincode}
            className="min-h-[38px] px-3.5 py-1.5 rounded bg-[#1b3022] text-white text-xs font-semibold hover:bg-[#2a4734] transition-colors cursor-pointer"
          >
            Check
          </button>
        </div>
        {pincodeResult.status !== "idle" && (
          <p
            role="status"
            className={`mt-1.5 text-[11px] font-medium ${
              pincodeResult.status === "ok" ? "text-[#1e5631]" : "text-[#8f2f2a]"
            }`}
          >
            {pincodeResult.text}
          </p>
        )}
      </div>

      {/* 8. Genuine Provenance Assurance & COD / B2B Inquiries */}
      <div className="mt-3 pt-2.5 border-t border-[#ede7dc] flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-[#556358]">
        <span className="font-medium text-[#2d4d38]">✓ 100% Genuine Direct from Origin · Cash on Delivery available (₹299+)</span>
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
