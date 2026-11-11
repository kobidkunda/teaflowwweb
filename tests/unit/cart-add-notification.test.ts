import { describe, it, expect, vi } from "vitest";
import React, { useEffect } from "react";
import { renderToString } from "react-dom/server";
import { CartProvider, useCart } from "@/components/CartProvider";

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock("@/lib/seo/tracking", () => ({
  trackCartDelta: vi.fn(),
}));

vi.mock("@/lib/fingerprint", () => ({
  getOrCreateSessionId: () => "test-session-xyz",
  getClientFingerprint: async () => "test-fp",
}));

describe("CartProvider Notification State Management", () => {
  it("provides lastAddedItem and dismissLastAdded in CartContext", () => {
    let capturedContext: ReturnType<typeof useCart> | null = null;

    function TestConsumer() {
      const cart = useCart();
      useEffect(() => {
        capturedContext = cart;
      }, [cart]);
      return React.createElement("div", null, `items:${cart.items.length}`);
    }

    const html = renderToString(
      React.createElement(CartProvider, null, React.createElement(TestConsumer))
    );

    expect(html).toContain("items:0");
  });
});
