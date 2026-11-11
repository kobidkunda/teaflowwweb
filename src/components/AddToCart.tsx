"use client";
import type { Product, Variant } from "@/lib/products";
import { useCart } from "@/components/CartProvider";
import React, { useState } from "react";

export function AddToCart({
  product,
  variant,
  accessibleLabel,
  disableModal = false,
}: {
  product: Product;
  variant: Variant;
  accessibleLabel?: string;
  disableModal?: boolean;
}) {
  const { add, openQuickModal } = useCart();
  const [added, setAdded] = useState(false);

  // Lowest amount / lowest price variant
  const lowestVariant =
    product.variants && product.variants.length > 0
      ? [...product.variants].sort((a, b) => a.price_paise - b.price_paise)[0] || variant
      : variant;

  const handleQuickAdd = () => {
    const target = lowestVariant || variant;
    if (!target || target.stock < 1) return;

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

    if (!disableModal && openQuickModal) {
      openQuickModal(product, target);
    }
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
      disabled={variant.stock < 1}
      onClick={handleQuickAdd}
    >
      {variant.stock < 1
        ? "Unavailable"
        : added
        ? "Added ✓ · Add another"
        : "Quick add +"}
    </button>
  );
}
