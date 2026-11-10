"use client";

import { useEffect, useRef } from "react";
import { catalogItem, trackViewItem } from "@/lib/seo/tracking";

import { CONSENT_EVENT } from "@/lib/seo/consent";

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
  const recorded = useRef("");
  const item = variant ? catalogItem(product, variant) : null;
  const signature = JSON.stringify(item);
  useEffect(() => {
    const record = () => {
      if (item && recorded.current !== signature && trackViewItem(item)) recorded.current = signature;
    };
    record(); window.addEventListener(CONSENT_EVENT, record);
    return () => window.removeEventListener(CONSENT_EVENT, record);
    // The serialized item captures the complete tracking payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return null;
}
