"use client";
import type { Product, Variant } from "@/lib/products";
import { useCart } from "@/components/CartProvider";
import React, { useState } from "react";

export function AddToCart({
  product,
  variant,
  accessibleLabel,
  disableModal = false,
  label,
}: {
  product: Product;
  variant?: Variant;
  accessibleLabel?: string;
  disableModal?: boolean;
  label?: React.ReactNode;
}) {
  const { add, openQuickModal } = useCart();
  const [added, setAdded] = useState(false);

  // Lowest in-stock variant, or fallback to lowest overall variant, or fallback to passed variant
  const inStockVariants = (product.variants || []).filter((v) => v.stock > 0);
  const sortedInStock = [...inStockVariants].sort((a, b) => a.price_paise - b.price_paise);
  const sortedAll = product.variants && product.variants.length > 0
    ? [...product.variants].sort((a, b) => a.price_paise - b.price_paise)
    : [];

  const lowestVariant = sortedInStock[0] || sortedAll[0] || variant;
  const target = (variant && variant.stock > 0) ? variant : (lowestVariant || variant);
  const isOutOfStock = !target || target.stock < 1;

  const handleQuickAdd = () => {
    if (isOutOfStock) return;

    if (!disableModal && openQuickModal) {
      openQuickModal(product, target);
      return;
    }

    add({
      variantId: target.id,
      sku: target.sku?.trim() || `HTH-${product.id}-${target.id}`,
      slug: product.slug,
      name: product.name,
      grams: target.grams,
      pricePaise: target.price_paise,
      imageUrl: target.product_image_url || product.primary_image_url || product.primary_image?.url || null,
    }, true, false);

    setAdded(true);
    setTimeout(() => setAdded(false), 2400);
  };

  return (
    <button
      type="button"
      className="button button-outline quick-add"
      aria-live="polite"
      aria-label={
        accessibleLabel
          ? `${added ? "Added to bag. " : ""}${accessibleLabel}`
          : undefined
      }
      disabled={isOutOfStock}
      onClick={handleQuickAdd}
    >
      {isOutOfStock
        ? "Unavailable"
        : added
        ? (label ? "Added to Cart ✓" : "Added ✓ · Add another")
        : label || "Quick add +"}
    </button>
  );
}
