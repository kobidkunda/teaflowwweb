"use client";

import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";

/**
 * Ensures the shopping bag is cleared when a customer lands on the order confirmation page.
 */
export function OrderCartClear() {
  const { clear } = useCart();

  useEffect(() => {
    clear();
  }, [clear]);

  return null;
}
