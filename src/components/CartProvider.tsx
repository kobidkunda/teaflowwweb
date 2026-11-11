"use client";
import { refreshCartPrices } from "@/lib/cartPricing";
import { cartImageKey } from "@/lib/cartImageHelper";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { trackCartDelta } from "@/lib/seo/tracking";
import { getOrCreateSessionId, getClientFingerprint } from "@/lib/fingerprint";
import type { Product, Variant } from "@/lib/productModels";

export type CartLine = {
  variantId: number;
  sku?: string;
  trialId?: string;
  slug: string;
  name: string;
  grams: number;
  pricePaise: number;
  quantity: number;
  imageUrl?: string | null;
  isWholesale?: boolean;
  wholesaleSlabPrice?: number;
  wholesaleMoq?: number;
};

export type AddedNotification = {
  id: string;
  item: CartLine;
  quantityAdded: number;
  timestamp: number;
};

export type QuickModalState = {
  product: Product;
  initialVariant: Variant;
};

type CartContextValue = {
  items: CartLine[];
  add: (
    line: Omit<CartLine, "quantity"> & { quantity?: number },
    track?: boolean,
    notify?: boolean
  ) => void;
  changeQuantity: (id: number | string, quantity: number, priceOverride?: number) => void;
  remove: (id: number | string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  sessionId: string;
  recoveryToken: string | null;
  isSyncing: boolean;
  lastAddedItem?: AddedNotification | null;
  dismissLastAdded?: () => void;
  quickModalState: QuickModalState | null;
  openQuickModal: (product: Product, initialVariant?: Variant) => void;
  closeQuickModal: () => void;
  replaceCartItem: (
    oldVariantId: number,
    newLine: Omit<CartLine, "quantity"> & { quantity?: number }
  ) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastAddedItem, setLastAddedItem] = useState<AddedNotification | null>(null);

  const dismissLastAdded = useCallback(() => {
    setLastAddedItem(null);
  }, []);

  const [quickModalState, setQuickModalState] = useState<QuickModalState | null>(null);

  const openQuickModal = useCallback((product: Product, initialVariant?: Variant) => {
    const lowestVariant =
      initialVariant ||
      [...product.variants].sort((a, b) => a.price_paise - b.price_paise)[0] ||
      product.variants[0];
    if (!lowestVariant) return;
    setQuickModalState({ product, initialVariant: lowestVariant });
  }, []);

  const closeQuickModal = useCallback(() => {
    setQuickModalState(null);
  }, []);

  const [catalogSkus, setCatalogSkus] = useState<Record<string, string>>({});
  const [catalogImages, setCatalogImages] = useState<Record<string, string | null>>({});
  // Identity-only dependency: quantity changes do not refetch catalogue photos.
  const imageItems = JSON.stringify(items.map((line) => line.trialId
    ? { trialId: line.trialId } : { variantId: line.variantId }));
  useEffect(() => {
    if (imageItems === "[]") return;
    const controller = new AbortController();
    const refresh = () => fetch(`/api/cart/images?${new URLSearchParams({ items: imageItems, includeTracking: "1", includePrices: "1" })}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data?.images) setCatalogImages(data.images);
        if (data?.prices) setItems(current => refreshCartPrices(current, data.prices));
        if (data?.tracking) setCatalogSkus(Object.fromEntries(Object.entries(data.tracking as Record<string, { item_id: string }>).map(([key, item]) => [key, item.item_id])));
      })
      .catch(() => { /* Unavailable images use the neutral placeholder. */ });
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); };
  }, [imageItems]);

  const displayItems = useMemo(() => items.map((line) => ({
    ...line, sku: catalogSkus[cartImageKey(line)] || line.sku, imageUrl: catalogImages[cartImageKey(line)] ?? null,
  })), [items, catalogImages, catalogSkus]);

  const lastSyncedRef = useRef<string>("");
  const isInitialMount = useRef<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Initial hydration from localStorage and session ID initialization
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("tea-house-cart") || "[]");
      if (Array.isArray(stored)) {
        setItems(
          stored.filter(
            (x) =>
              (Number.isInteger(x.variantId) || typeof x.trialId === "string") &&
              Number.isInteger(x.quantity) &&
              x.quantity > 0 &&
              x.quantity <= 10000 &&
              typeof x.name === "string" &&
              Number.isFinite(x.pricePaise)
          )
        );
      }
    } catch {
      /* Invalid saved cart: start empty. */
    }

    const sid = getOrCreateSessionId();
    setSessionId(sid);
    setHydrated(true);
  }, []);

  // 2. Local storage persistence on state change
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem("tea-house-cart", JSON.stringify(items));
    }
  }, [items, hydrated]);

  // 3. Debounced (1000ms) background server sync with AbortController
  useEffect(() => {
    if (!hydrated) return;

    const currentNormalized = JSON.stringify(
      items.map((x) => ({ variantId: x.variantId, trialId: x.trialId, quantity: x.quantity }))
    );

    // Skip syncing initial empty cart on first mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSyncedRef.current = currentNormalized;
      if (items.length === 0) return;
    }

    // Skip sync if items have not changed since last sync
    if (currentNormalized === lastSyncedRef.current) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsSyncing(true);

        // Abort previous pending sync if any
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const sid = sessionId || getOrCreateSessionId();
        const fingerprint = await getClientFingerprint();

        const syncPayload = {
          sessionId: sid,
          fingerprint,
          items: items.map((x) => ({
            variantId: x.variantId,
            trialId: x.trialId,
            quantity: x.quantity,
          })),
        };

        const res = await fetch("/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(syncPayload),
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.recoveryToken) {
            setRecoveryToken(data.recoveryToken);
          }
          lastSyncedRef.current = currentNormalized;
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          // Fail silently in the background: never interrupt customer experience
        }
      } finally {
        setIsSyncing(false);
      }
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      abortControllerRef.current?.abort();
    };
  }, [items, hydrated, sessionId]);

  const add = (
    line: Omit<CartLine, "quantity"> & { quantity?: number },
    track = true,
    notify = track
  ) => {
    const qtyToAdd = Math.max(1, line.quantity || 1);
    const maxQty = line.isWholesale ? 10000 : 20;
    const existing = items.find(x => line.trialId ? x.trialId === line.trialId : !x.trialId && x.variantId === line.variantId);
    if (existing && existing.quantity >= (existing.isWholesale ? 10000 : 20)) return;
    if (track) void trackCartDelta(line, qtyToAdd, "add");

    if (notify) {
      const resolvedImg = line.imageUrl || catalogImages[cartImageKey(line)] || null;
      setLastAddedItem({
        id: `${line.trialId || line.variantId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        item: {
          ...line,
          quantity: qtyToAdd,
          imageUrl: resolvedImg,
        },
        quantityAdded: qtyToAdd,
        timestamp: Date.now(),
      });
    }

    setItems((current) => {
      const matchIndex = current.findIndex((x) =>
        line.trialId ? x.trialId === line.trialId : x.variantId === line.variantId
      );
      if (matchIndex >= 0) {
        return current.map((x, idx) =>
          idx === matchIndex
            ? {
                ...x,
                ...line,
                quantity: Math.min(maxQty, x.quantity + qtyToAdd),
                pricePaise: line.pricePaise ?? x.pricePaise,
              }
            : x
        );
      }
      return [...current, { ...line, quantity: Math.min(maxQty, qtyToAdd) }];
    });
  };

  const matchesLine = (x: CartLine, id: number | string) =>
    typeof id === "string" ? x.trialId === id : !x.trialId && x.variantId === id;

  const changeQuantity = (id: number | string, quantity: number, priceOverride?: number) => {
    if (!Number.isFinite(quantity)) return;
    const line = displayItems.find(x => matchesLine(x, id));
    if (!line) return;
    const maxQty = line.isWholesale ? 10000 : 20;
    const next = Math.max(1, Math.min(maxQty, Math.trunc(quantity)));
    if (line.quantity === next && priceOverride === undefined) return;
    void trackCartDelta(line, Math.abs(next - line.quantity), next > line.quantity ? "add" : "remove");
    setItems(current => current.map(x => matchesLine(x, id) ? {
      ...x,
      quantity: next,
      ...(priceOverride !== undefined && priceOverride >= 0 ? { pricePaise: priceOverride } : {}),
    } : x));
  };

  const remove = (id: number | string) => {
    const itemToRemove = displayItems.find((x) => matchesLine(x, id));
    if (itemToRemove) {
      void trackCartDelta(itemToRemove, itemToRemove.quantity, "remove");
    }
    setItems((current) => current.filter((x) => !matchesLine(x, id)));
  };

  const replaceCartItem = useCallback((
    oldVariantId: number,
    newLine: Omit<CartLine, "quantity"> & { quantity?: number }
  ) => {
    const newQty = Math.max(1, newLine.quantity || 1);
    const maxQty = newLine.isWholesale ? 10000 : 20;
    const clampedQty = Math.min(maxQty, newQty);

    setItems((current) => {
      const isSameVariant = oldVariantId === newLine.variantId;
      if (isSameVariant) {
        return current.map((x) =>
          x.variantId === oldVariantId
            ? {
                ...x,
                ...newLine,
                quantity: clampedQty,
              }
            : x
        );
      }

      // Different variant: remove oldVariantId and add/update newLine
      const filtered = current.filter((x) => x.variantId !== oldVariantId);
      const existingIndex = filtered.findIndex((x) => x.variantId === newLine.variantId);

      if (existingIndex >= 0) {
        return filtered.map((x, idx) =>
          idx === existingIndex
            ? {
                ...x,
                ...newLine,
                quantity: clampedQty,
              }
            : x
        );
      }

      return [
        ...filtered,
        {
          ...newLine,
          quantity: clampedQty,
        },
      ];
    });

    const oldItem = displayItems.find((x) => x.variantId === oldVariantId);
    if (oldItem && oldVariantId !== newLine.variantId) {
      void trackCartDelta(oldItem, oldItem.quantity, "remove");
    }
    void trackCartDelta(newLine, clampedQty, "add");
  }, [displayItems]);

  const clear = () => setItems([]);
  const count = items.reduce((sum, x) => sum + x.quantity, 0);
  const subtotal = items.reduce((sum, x) => sum + x.pricePaise * x.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items: displayItems,
        add,
        changeQuantity,
        remove,
        clear,
        count,
        subtotal,
        sessionId,
        recoveryToken,
        isSyncing,
        lastAddedItem,
        dismissLastAdded,
        quickModalState,
        openQuickModal,
        closeQuickModal,
        replaceCartItem,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart requires CartProvider");
  return value;
}
