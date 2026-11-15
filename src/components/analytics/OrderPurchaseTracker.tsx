"use client";

import { useEffect, useRef } from "react";
import { trackPurchase, type TrackingItem } from "@/lib/seo/tracking";
import { currencyDigits } from "@/lib/international/money";
import { sendFunnelEvent } from "@/lib/funnel/clientAttribution";

export interface OrderPurchaseTrackerProps {
  orderId: string;
  verifiedPaid?: boolean;
  totalPaise?: number;
  totalMinor?: number;
  shippingPaise?: number;
  shippingMinor?: number;
  taxPaise?: number | null;
  taxMinor?: number | null;
  currency?: string;
  items: TrackingItem[];
}

export function OrderPurchaseTracker({
  orderId,
  verifiedPaid = false,
  totalPaise,
  totalMinor,
  shippingPaise,
  shippingMinor,
  taxPaise,
  taxMinor,
  currency = "INR",
  items,
}: OrderPurchaseTrackerProps) {
  const firstPartySent = useRef<string>("");
  useEffect(() => {
    if (!orderId || !verifiedPaid) return;

    const divisor = 10 ** currencyDigits(currency);
    const totalValue = (totalMinor ?? totalPaise ?? 0) / divisor;
    const shippingValue = (shippingMinor ?? shippingPaise ?? 0) / divisor;
    const taxValue = ((taxMinor ?? taxPaise) ?? 0) / divisor;

    if (firstPartySent.current !== orderId) {
      firstPartySent.current = orderId;
      sendFunnelEvent({
        eventId: `purchase_${orderId}`,
        funnelStage: "order_paid",
        eventName: "purchase",
        entityType: "order",
        entityId: orderId,
        valuePaise: Math.round(totalMinor ?? totalPaise ?? 0),
        currency,
        metadata: {
          itemCount: items.reduce((s, i) => s + (i.quantity ?? 1), 0),
        },
      });
    }

    trackPurchase(
      orderId,
      Math.max(0, totalValue - shippingValue - taxValue),
      shippingValue,
      taxValue,
      items,
      currency,
      totalValue
    );
  }, [verifiedPaid, orderId, totalPaise, totalMinor, shippingPaise, shippingMinor, taxPaise, taxMinor, currency, items]);

  return null;
}
