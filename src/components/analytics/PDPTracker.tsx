"use client";

import { useEffect, useRef } from "react";
import { catalogItem, trackViewItem } from "@/lib/seo/tracking";
import { sendFunnelEvent } from "@/lib/funnel/clientAttribution";

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
  const firstPartyRecorded = useRef("");
  const item = variant ? catalogItem(product, variant) : null;
  const signature = JSON.stringify(item);
  useEffect(() => {
    if (firstPartyRecorded.current !== signature) {
      firstPartyRecorded.current = signature;
      sendFunnelEvent({
        funnelStage: "product_view",
        eventName: "view_item",
        entityType: "product",
        entityId: String(product.id),
        valuePaise: variant?.price_paise ?? 0,
        metadata: {
          slug: product.slug,
          name: product.name,
          category: product.category || "",
          sku: item?.item_id || "",
        },
      });
    }
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
