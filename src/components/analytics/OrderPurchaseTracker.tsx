"use client";

import { useEffect } from "react";
import { trackPurchase, type TrackingItem } from "@/lib/seo/tracking";
import { currencyDigits } from "@/lib/international/money";

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
  useEffect(() => {
    if (!orderId || !verifiedPaid) return;

    const divisor = 10 ** currencyDigits(currency);
    const totalValue = (totalMinor ?? totalPaise ?? 0) / divisor;
    const shippingValue = (shippingMinor ?? shippingPaise ?? 0) / divisor;
    const taxValue = ((taxMinor ?? taxPaise) ?? 0) / divisor;

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
