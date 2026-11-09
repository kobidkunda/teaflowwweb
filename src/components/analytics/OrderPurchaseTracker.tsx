"use client";

import { useEffect } from "react";
import { trackPurchase, type TrackingItem } from "@/lib/seo/tracking";
import { currencyDigits } from "@/lib/international/money";

export interface OrderPurchaseTrackerProps {
  orderId: string;
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
    if (!orderId) return;

    // Deduplication safeguard in sessionStorage:
    // Ensures page refresh or back/forward navigation does not inflate purchase conversions.
    const storageKey = `gtm_tracked_purchase_${orderId}`;
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        if (sessionStorage.getItem(storageKey)) {
          return;
        }
        sessionStorage.setItem(storageKey, "1");
      }
    } catch {
      // In private browsing if sessionStorage fails, proceed gracefully
    }

    const divisor = 10 ** currencyDigits(currency);
    const totalValue = (totalMinor ?? totalPaise ?? 0) / divisor;
    const shippingValue = (shippingMinor ?? shippingPaise ?? 0) / divisor;
    const taxValue = ((taxMinor ?? taxPaise) ?? 0) / divisor;

    trackPurchase(
      orderId,
      totalValue,
      shippingValue,
      taxValue,
      items,
      currency
    );
  }, [orderId, totalPaise, totalMinor, shippingPaise, shippingMinor, taxPaise, taxMinor, currency, items]);

  return null;
}
