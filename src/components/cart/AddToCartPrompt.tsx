"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useCart } from "@/components/CartProvider";
import {
  useDisplayMoney,
  LocalizedLink as Link,
  Text as StorefrontText,
} from "@/components/international/InternationalProvider";
import { CartItemImage } from "@/components/CartItemImage";
import { cartImageKey } from "@/lib/cartImageHelper";
import { Check, X, ArrowRight, ShoppingBag } from "lucide-react";
import { usePathname } from "next/navigation";

const AUTO_DISMISS_MS = 7000;

export function AddToCartPrompt() {
  const { lastAddedItem, dismissLastAdded, count, subtotal, items } = useCart();
  const formatMoney = useDisplayMoney();
  const pathname = usePathname();

  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(AUTO_DISMISS_MS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const promptRef = useRef<HTMLDivElement | null>(null);

  const isVisible = Boolean(lastAddedItem && !pathname?.startsWith("/checkout"));

  // Dismiss on Escape key
  useEffect(() => {
    if (!isVisible || !dismissLastAdded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismissLastAdded();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, dismissLastAdded]);

  // Handle countdown & auto-dismiss with pause on hover/focus
  useEffect(() => {
    if (!isVisible || !dismissLastAdded || !lastAddedItem) {
      setProgress(100);
      remainingTimeRef.current = AUTO_DISMISS_MS;
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Reset when a new item is added
    remainingTimeRef.current = AUTO_DISMISS_MS;
    startTimeRef.current = Date.now();
    setProgress(100);

    const interval = 50; // update progress smoothly
    timerRef.current = setInterval(() => {
      if (isPaused) {
        startTimeRef.current = Date.now() - (AUTO_DISMISS_MS - remainingTimeRef.current);
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, AUTO_DISMISS_MS - elapsed);
      remainingTimeRef.current = remaining;
      setProgress((remaining / AUTO_DISMISS_MS) * 100);

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        dismissLastAdded();
      }
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lastAddedItem?.id, isVisible, isPaused, dismissLastAdded]);

  if (!isVisible || !lastAddedItem) {
    return null;
  }

  const item = lastAddedItem.item;
  const quantityAdded = lastAddedItem.quantityAdded;
  // Resolve image either from item, or from cart catalog image store
  const matchedItem = items.find((x) => cartImageKey(x) === cartImageKey(item));
  const imageUrl = item.imageUrl || matchedItem?.imageUrl || null;

  return (
    <div
      role="region"
      aria-label="Added to bag notification"
      className="add-to-cart-prompt-container"
      ref={promptRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        // Only unpause if focus actually left the prompt container
        if (!promptRef.current?.contains(e.relatedTarget as Node)) {
          setIsPaused(false);
        }
      }}
    >
      {/* Screen reader polite announcement without interrupting */}
      <div aria-live="polite" className="sr-only">
        {`${item.name} `}
        <StorefrontText id="copy_63634774a91dd9b2" fallback="added to your bag. Actions available: Proceed to checkout or Add more items." />
      </div>

      <div className="add-to-cart-prompt-card" data-testid="add-to-cart-prompt">
        {/* Header */}
        <div className="add-to-cart-prompt-header">
          <div className="add-to-cart-prompt-badge">
            <span className="add-to-cart-prompt-check" aria-hidden="true">
              <Check size={13} strokeWidth={2.8} />
            </span>
            <span className="add-to-cart-prompt-title">
              <StorefrontText id="copy_added_to_bag_heading" fallback="Added to Bag" />
            </span>
          </div>

          <button
            type="button"
            className="add-to-cart-prompt-close"
            onClick={dismissLastAdded}
            aria-label="Close notification"
          >
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>

        {/* Product Details Row */}
        <div className="add-to-cart-prompt-body">
          <div className="add-to-cart-prompt-image-wrapper">
            <CartItemImage
              src={imageUrl}
              name={item.name}
              size={54}
              className="add-to-cart-prompt-image"
            />
          </div>

          <div className="add-to-cart-prompt-info">
            <h4 className="add-to-cart-prompt-name" title={item.name}>
              {item.name}
            </h4>
            <div className="add-to-cart-prompt-meta">
              <span>{item.grams >= 1000 ? `${item.grams / 1000}kg` : `${item.grams}g`}</span>
              {item.isWholesale && <span className="add-to-cart-prompt-tag"><StorefrontText id="copy_09513d0ed97381c5" fallback="Wholesale" /></span>}
            </div>
            <div className="add-to-cart-prompt-pricing">
              <span className="add-to-cart-prompt-qty">
                {quantityAdded > 1 ? `Qty: ${quantityAdded} × ` : ""}
              </span>
              <span className="add-to-cart-prompt-price">
                {formatMoney(item.pricePaise)}
              </span>
            </div>
          </div>
        </div>

        {/* Bag Subtotal & Count Summary */}
        <div className="add-to-cart-prompt-summary">
          <span className="add-to-cart-prompt-summary-label">
            <StorefrontText id="copy_bag_subtotal_label" fallback="Bag subtotal" />{" "}
            <span className="text-[#65746D]">
              ({count} {count === 1 ? "item" : "items"}):
            </span>
          </span>
          <span className="add-to-cart-prompt-summary-amount font-semibold text-[#171713]">
            {formatMoney(subtotal)}
          </span>
        </div>

        {/* Actions Suite */}
        <div className="add-to-cart-prompt-actions">
          {/* Primary CTA: Proceed to Checkout */}
          <Link
            href="/checkout"
            onClick={dismissLastAdded}
            className="add-to-cart-btn-primary"
            data-testid="prompt-proceed-checkout"
          >
            <span>
              <StorefrontText id="copy_proceed_checkout" fallback="Proceed to Checkout" />
            </span>
            <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
          </Link>

          {/* Secondary CTA: Add More Items */}
          <button
            type="button"
            onClick={dismissLastAdded}
            className="add-to-cart-btn-secondary"
            data-testid="prompt-add-more-items"
          >
            <ShoppingBag size={13} strokeWidth={2} aria-hidden="true" />
            <span>
              <StorefrontText id="copy_add_more_items" fallback="Add More Items" />
            </span>
          </button>
        </div>

        {/* Optional tertiary link: View Bag */}
        <div className="add-to-cart-prompt-footer">
          <Link
            href="/cart"
            onClick={dismissLastAdded}
            className="add-to-cart-prompt-view-bag"
          >
            <StorefrontText id="copy_view_bag_link" fallback="View Bag & Order Summary →" />
          </Link>
        </div>

        {/* Countdown progress bar */}
        <div
          className="add-to-cart-prompt-progress-track"
          aria-hidden="true"
        >
          <div
            className="add-to-cart-prompt-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
