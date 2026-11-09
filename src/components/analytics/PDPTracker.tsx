"use client";

import { useEffect } from "react";
import { trackViewItem } from "@/lib/seo/tracking";

export interface PDPTrackerProps {
  product: {
    id: number;
    slug: string;
    name: string;
    category?: string;
  };
  variant?: {
    id: number;
    sku?: string;
    price_paise: number;
  };
}

export function PDPTracker({ product, variant }: PDPTrackerProps) {
  useEffect(() => {
    if (!product) return;

    const price = (variant?.price_paise ?? 0) / 100;
    const itemId = variant?.sku || String(variant?.id ?? product.id);

    trackViewItem({
      item_id: itemId,
      item_name: product.name,
      item_category: product.category,
      price,
    });
  }, [product, variant]);

  return null;
}
