"use client";

import React, { useEffect, useRef, useState, useCallback, useId } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import {
  useDisplayMoney,
  LocalizedLink as Link,
  Text as StorefrontText,
} from "@/components/international/InternationalProvider";
import { cupsFromGrams } from "@/lib/money";
import type { Variant } from "@/lib/productModels";
import {
  Check,
  X,
  ShoppingBag,
  ArrowRight,
  Plus,
  Minus,
  Sparkles,
  Truck,
} from "lucide-react";

export function QuickVariantModal() {
  const router = useRouter();
  const formatMoney = useDisplayMoney();
  const titleId = useId();

  const {
    quickModalState,
    closeQuickModal,
    replaceCartItem,
    subtotal: cartSubtotal,
    count: cartCount,
  } = useCart();

  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  const product = quickModalState?.product ?? null;
  const initialVariant = quickModalState?.initialVariant ?? null;

  const [selectedVariantId, setSelectedVariantId] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [isWholesale, setIsWholesale] = useState<boolean>(false);
  const [isUpdated, setIsUpdated] = useState<boolean>(false);
  const [lastUpdatedVariantId, setLastUpdatedVariantId] = useState<number>(0);

  // Initialize selection whenever a new product/variant is opened
  useEffect(() => {
    if (quickModalState && initialVariant) {
      setSelectedVariantId(initialVariant.id);
      setQuantity(1);
      setIsWholesale(false);
      setIsUpdated(false);
      setLastUpdatedVariantId(initialVariant.id);
    }
  }, [quickModalState?.product?.id, initialVariant?.id]);

  // Accessibility: Focus trap, Esc to close, body scroll locking
  useEffect(() => {
    if (!quickModalState) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus inside modal
    const timer = setTimeout(() => {
      modalRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeQuickModal();
      } else if (e.key === "Tab" && modalRef.current) {
        // Focus trap
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [quickModalState, closeQuickModal]);

  if (!quickModalState || !product || !initialVariant) {
    return null;
  }

  const activeVariant: Variant =
    product.variants.find((v) => v.id === selectedVariantId) ||
    initialVariant ||
    product.variants[0];

  const variants = product.variants && product.variants.length > 0 ? product.variants : [initialVariant];

  // Wholesale slabs calculation
  const wholesaleSlabs = activeVariant.wholesale_slabs || [];
  const hasWholesale = wholesaleSlabs.length > 0;
  const wholesaleMoq = product.wholesale_moq || 50;

  // Resolve unit price
  let activeUnitPricePaise = activeVariant.price_paise;
  let activeSlab = null;
  if (isWholesale && hasWholesale) {
    const sortedSlabs = [...wholesaleSlabs].sort((a, b) => b.min_qty - a.min_qty);
    activeSlab = sortedSlabs.find((s) => quantity >= s.min_qty) || sortedSlabs[sortedSlabs.length - 1];
    if (activeSlab) {
      activeUnitPricePaise = activeSlab.price_paise;
    }
  }

  const lineSubtotalPaise = activeUnitPricePaise * quantity;
  const initialLineSubtotal = initialVariant.price_paise * 1;
  const hasChanged =
    selectedVariantId !== lastUpdatedVariantId ||
    quantity !== (isUpdated ? quantity : 1) ||
    isWholesale;

  // Toggle variant
  const handleSelectVariant = (variantId: number) => {
    setSelectedVariantId(variantId);
    setIsUpdated(false);
  };

  // Toggle wholesale mode
  const handleToggleWholesale = (enabled: boolean) => {
    setIsWholesale(enabled);
    setIsUpdated(false);
    if (enabled) {
      const minQty = wholesaleSlabs[0]?.min_qty || wholesaleMoq;
      if (quantity < minQty) {
        setQuantity(minQty);
      }
    } else {
      if (quantity > 20) {
        setQuantity(1);
      }
    }
  };

  // Quantity adjustments
  const minQty = isWholesale ? (wholesaleSlabs[0]?.min_qty || wholesaleMoq) : 1;
  const maxQty = isWholesale ? 10000 : 20;

  const handleStep = (delta: number) => {
    const stepSize = isWholesale ? (quantity >= 100 ? 50 : 25) : 1;
    const next = Math.max(minQty, Math.min(maxQty, quantity + delta * stepSize));
    setQuantity(next);
    setIsUpdated(false);
  };

  // Execute update
  const handleUpdate = () => {
    replaceCartItem(initialVariant.id, {
      variantId: activeVariant.id,
      sku: activeVariant.sku?.trim() || `HTH-${product.id}-${activeVariant.id}`,
      slug: product.slug,
      name: product.name,
      grams: activeVariant.grams,
      pricePaise: activeUnitPricePaise,
      quantity,
      imageUrl: activeVariant.product_image_url || product.primary_image_url || product.primary_image?.url || null,
      isWholesale,
      wholesaleSlabPrice: isWholesale ? activeUnitPricePaise : undefined,
      wholesaleMoq: isWholesale ? wholesaleMoq : undefined,
    });
    setLastUpdatedVariantId(activeVariant.id);
    setIsUpdated(true);
  };

  // Proceed to checkout
  const handleProceedCheckout = () => {
    if (hasChanged && !isUpdated) {
      handleUpdate();
    }
    closeQuickModal();
    router.push("/checkout");
  };

  const imageUrl =
    product.primary_image?.url ||
    product.primary_image_url ||
    activeVariant.product_image_url ||
    "/uploads/product-darjeeling-tin.jpg";

  const imageAlt =
    product.primary_image?.alt_text ||
    `Packaging for ${product.name}`;

  return (
    <div
      className="quick-variant-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeQuickModal();
      }}
    >
      <div
        className="quick-variant-modal-card"
        ref={modalRef}
        tabIndex={-1}
        role="document"
      >
        {/* Header Bar */}
        <div className="quick-variant-header">
          <div className="quick-variant-badge">
            <span className="quick-variant-check-icon" aria-hidden="true">
              <Check size={14} strokeWidth={2.8} />
            </span>
            <span className="quick-variant-status-text">
              {isUpdated ? (
                <StorefrontText id="quick_modal.bag_updated" fallback="Bag Updated ✓" />
              ) : (
                <StorefrontText id="quick_modal.added_to_bag" fallback="Added to Bag ✓" />
              )}
            </span>
          </div>

          <button
            type="button"
            className="quick-variant-close-btn"
            onClick={closeQuickModal}
            aria-label="Close modal"
          >
            <X size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="quick-variant-body">
          {/* Product Mini Row */}
          <div className="quick-variant-product-row">
            <div className="quick-variant-img-wrap">
              <Image
                src={imageUrl}
                alt={imageAlt}
                width={76}
                height={76}
                className="quick-variant-img"
                style={{ objectFit: "contain" }}
              />
            </div>
            <div className="quick-variant-product-meta">
              <span className="quick-variant-eyebrow">
                {[product.origin, product.category].filter(Boolean).join(" · ")}
              </span>
              <h3 id={titleId} className="quick-variant-title">
                <Link
                  href={`/tea/${product.slug}`}
                  onClick={closeQuickModal}
                  title={product.name}
                >
                  {product.name}
                </Link>
              </h3>
              <p className="quick-variant-selected-summary">
                <span className="font-semibold text-[#18231c]">
                  {activeVariant.grams >= 1000 ? `${activeVariant.grams / 1000}kg` : `${activeVariant.grams}g`}
                </span>
                {" · "}
                <span>
                  {activeVariant.packaging_format === "luxury_tin"
                    ? "Luxury Tin"
                    : activeVariant.packaging_format === "pyramid_bags"
                    ? "Pyramid Bags"
                    : "Pouch"}
                </span>
                {" · "}
                <strong className="text-[#23483a]">
                  {formatMoney(activeUnitPricePaise)}
                </strong>
                {activeVariant.grams > 0 && (
                  <span className="text-[#707c72] text-[11px] ml-1">
                    (~{cupsFromGrams(activeVariant.grams)} cups)
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Wholesale Mode Switcher (if applicable) */}
          {hasWholesale && (
            <div className="quick-variant-wholesale-banner">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-700">🌿</span>
                  <div>
                    <strong className="text-xs text-[#1e3a2b] block">
                      <StorefrontText id="quick_modal.wholesale_available" fallback="Wholesale Pricing Available" />
                    </strong>
                    <span className="text-[11px] text-[#556b5d]">
                      <StorefrontText id="quick_modal.wholesale_from" fallback="Tiered bulk rates starting from" /> {wholesaleMoq} <StorefrontText id="quick_modal.pcs" fallback="pcs" />
                    </span>
                  </div>
                </div>
                <div className="quick-variant-mode-pills" role="radiogroup" aria-label="Purchase Mode">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!isWholesale}
                    className={`quick-variant-mode-btn ${!isWholesale ? "active" : ""}`}
                    onClick={() => handleToggleWholesale(false)}
                  >
                    <StorefrontText id="quick_modal.retail" fallback="Retail" />
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isWholesale}
                    className={`quick-variant-mode-btn ${isWholesale ? "active" : ""}`}
                    onClick={() => handleToggleWholesale(true)}
                  >
                    <StorefrontText id="quick_modal.wholesale" fallback="Wholesale" />
                  </button>
                </div>
              </div>

              {isWholesale && (
                <div className="mt-3 pt-2.5 border-t border-[#c6dfcd] text-[11px] text-[#2b4c37]">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5 font-medium">
                    {wholesaleSlabs.map((s, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded text-[11px] border ${
                          quantity >= s.min_qty
                            ? "bg-[#23483a] text-white border-[#23483a] font-semibold"
                            : "bg-white/80 text-[#23483a] border-[#b7d6be]"
                        }`}
                      >
                        {s.min_qty}+ pcs: {formatMoney(s.price_paise)}/pc
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#4d6b56]">
                    <Truck size={12} aria-hidden="true" />
                    <span>
                      <StorefrontText
                        id="quick_modal.transport_notice"
                        fallback="Dispatched via commercial surface transport (Freight To-Pay at destination delivery)."
                      />
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Variant Selection Options */}
          <div className="quick-variant-section">
            <div className="flex items-center justify-between mb-2">
              <label className="quick-variant-section-label">
                <StorefrontText id="quick_modal.select_size" fallback="Select Size & Format" />
              </label>
              <span className="text-[11px] text-[#717b73]">
                {variants.length} {variants.length === 1 ? "option" : "options available"}
              </span>
            </div>

            <div className="quick-variant-grid" role="radiogroup" aria-label="Product Variants">
              {variants.map((v) => {
                const isSelected = v.id === activeVariant.id;
                const isLowest = v.id === initialVariant.id;
                const discountPct =
                  v.compare_at_price_paise && v.compare_at_price_paise > v.price_paise
                    ? Math.round(((v.compare_at_price_paise - v.price_paise) / v.compare_at_price_paise) * 100)
                    : 0;

                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`quick-variant-pill ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectVariant(v.id)}
                  >
                    <div className="quick-variant-pill-top">
                      <span className="quick-variant-pill-weight">
                        {v.grams >= 1000 ? `${v.grams / 1000}kg` : `${v.grams}g`}
                      </span>
                      <span className="quick-variant-pill-format">
                        {v.packaging_format === "luxury_tin"
                          ? "Tin"
                          : v.packaging_format === "pyramid_bags"
                          ? "Bags"
                          : "Pouch"}
                      </span>
                      {isLowest && (
                        <span className="quick-variant-pill-initial-tag" title="Auto-selected lowest price">
                          <StorefrontText id="quick_modal.lowest_tag" fallback="Default" />
                        </span>
                      )}
                    </div>

                    <div className="quick-variant-pill-bottom">
                      <div>
                        <strong className="quick-variant-pill-price">
                          {formatMoney(v.price_paise)}
                        </strong>
                        <span className="text-[10px] text-[#707c72] ml-1">
                          (~{cupsFromGrams(v.grams).toLocaleString("en-IN")} cups)
                        </span>
                      </div>
                      {discountPct > 0 && (
                        <span className="quick-variant-pill-discount">
                          {discountPct}% OFF
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <span className="quick-variant-pill-check" aria-hidden="true">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity Stepper Row */}
          <div className="quick-variant-qty-row">
            <div>
              <label className="quick-variant-section-label block mb-0.5">
                <StorefrontText id="quick_modal.quantity" fallback="Quantity" />
              </label>
              <span className="text-[11px] text-[#717b73]">
                {isWholesale ? `Min MOQ ${minQty} pcs` : `Max 20 units per order`}
              </span>
            </div>

            <div className="quick-variant-stepper" role="group" aria-label="Quantity Stepper">
              <button
                type="button"
                className="quick-variant-stepper-btn"
                onClick={() => handleStep(-1)}
                disabled={quantity <= minQty}
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className="quick-variant-stepper-value" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                className="quick-variant-stepper-btn"
                onClick={() => handleStep(1)}
                disabled={quantity >= maxQty}
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Subtotal & Line Price Calculation Bar */}
          <div className="quick-variant-summary-bar">
            <div>
              <span className="text-xs text-[#616e64] block">
                <StorefrontText id="quick_modal.selection_total" fallback="Selection Total" />
              </span>
              <div className="flex items-baseline gap-2">
                <strong className="text-lg font-serif text-[#18231c]">
                  {formatMoney(lineSubtotalPaise)}
                </strong>
                {quantity > 1 && (
                  <span className="text-xs text-[#6e7b71]">
                    ({quantity} × {formatMoney(activeUnitPricePaise)})
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-[#616e64] block">
                <StorefrontText id="quick_modal.bag_subtotal" fallback="Current Bag Subtotal" />
              </span>
              <span className="text-sm font-semibold text-[#23483a]">
                {formatMoney(cartSubtotal)} ({cartCount} {cartCount === 1 ? "item" : "items"})
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions Suite */}
        <div className="quick-variant-footer">
          {hasChanged && !isUpdated ? (
            <button
              type="button"
              className="quick-variant-btn-update"
              onClick={handleUpdate}
              data-testid="quick-modal-update-btn"
            >
              <ShoppingBag size={15} aria-hidden="true" />
              <span>
                <StorefrontText id="quick_modal.update_bag" fallback="Update Bag" /> • {formatMoney(lineSubtotalPaise)}
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="quick-variant-btn-checkout"
              onClick={handleProceedCheckout}
              data-testid="quick-modal-checkout-btn"
            >
              <span>
                <StorefrontText id="quick_modal.proceed_checkout" fallback="Proceed to Checkout" />
              </span>
              <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
            </button>
          )}

          <div className="quick-variant-footer-links">
            <Link
              href="/cart"
              onClick={closeQuickModal}
              className="quick-variant-secondary-link"
            >
              <StorefrontText id="quick_modal.view_bag" fallback="View Bag & Order Summary →" />
            </Link>

            <button
              type="button"
              onClick={closeQuickModal}
              className="quick-variant-keep-shopping-btn"
            >
              <StorefrontText id="quick_modal.keep_shopping" fallback="Keep Shopping" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
