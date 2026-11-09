"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { trackAddToCart, trackRemoveFromCart } from "@/lib/seo/tracking";
import { getOrCreateSessionId, getClientFingerprint } from "@/lib/fingerprint";

export type CartLine = {
  variantId: number;
  trialId?: string;
  slug: string;
  name: string;
  grams: number;
  pricePaise: number;
  quantity: number;
};

type CartContextValue = {
  items: CartLine[];
  add: (line: Omit<CartLine, "quantity">) => void;
  changeQuantity: (id: number | string, quantity: number) => void;
  remove: (id: number | string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  sessionId: string;
  recoveryToken: string | null;
  isSyncing: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

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
              x.quantity <= 20 &&
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

  const add = (line: Omit<CartLine, "quantity">) => {
    trackAddToCart(
      {
        item_id: line.trialId || String(line.variantId),
        item_name: line.name,
        price: line.pricePaise / 100,
        quantity: 1,
      },
      1
    );
    setItems((current) => {
      const matchIndex = current.findIndex((x) =>
        line.trialId ? x.trialId === line.trialId : x.variantId === line.variantId
      );
      if (matchIndex >= 0) {
        return current.map((x, idx) =>
          idx === matchIndex
            ? { ...x, quantity: Math.min(20, x.quantity + 1) }
            : x
        );
      }
      return [...current, { ...line, quantity: 1 }];
    });
  };

  const matchesLine = (x: CartLine, id: number | string) =>
    typeof id === "string" ? x.trialId === id : !x.trialId && x.variantId === id;

  const changeQuantity = (id: number | string, quantity: number) =>
    setItems((current) =>
      current.map((x) =>
        matchesLine(x, id)
          ? { ...x, quantity: Math.max(1, Math.min(20, quantity)) }
          : x
      )
    );

  const remove = (id: number | string) => {
    const itemToRemove = items.find((x) => matchesLine(x, id));
    if (itemToRemove) {
      trackRemoveFromCart(
        {
          item_id: itemToRemove.trialId || String(itemToRemove.variantId),
          item_name: itemToRemove.name,
          price: itemToRemove.pricePaise / 100,
          quantity: itemToRemove.quantity,
        },
        itemToRemove.quantity
      );
    }
    setItems((current) => current.filter((x) => !matchesLine(x, id)));
  };

  const clear = () => setItems([]);
  const count = items.reduce((sum, x) => sum + x.quantity, 0);
  const subtotal = items.reduce((sum, x) => sum + x.pricePaise * x.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        add,
        changeQuantity,
        remove,
        clear,
        count,
        subtotal,
        sessionId,
        recoveryToken,
        isSyncing,
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
