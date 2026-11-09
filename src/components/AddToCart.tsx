"use client";
import type { Product, Variant } from "@/lib/products";
import { useCart } from "@/components/CartProvider";
import React, { useState } from "react";
export function AddToCart({ product, variant, accessibleLabel }: { product: Product; variant: Variant; accessibleLabel?: string }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  return <button className="button button-outline quick-add" aria-live="polite" aria-label={accessibleLabel ? `${added ? "Added to bag. " : ""}${accessibleLabel}` : undefined} disabled={variant.stock < 1} onClick={() => {
    add({ variantId: variant.id, slug: product.slug, name: product.name, grams: variant.grams, pricePaise: variant.price_paise });
    setAdded(true);
  }}>{variant.stock < 1 ? "Unavailable" : added ? "Added ✓ · Add another" : "Quick add +"}</button>;
}
