import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AddToCartPrompt } from "@/components/cart/AddToCartPrompt";
import type { AddedNotification } from "@/components/CartProvider";

(globalThis as unknown as { React: typeof React }).React = React;

let mockLastAddedItem: AddedNotification | null = null;
let mockPathname = "/shop";
const mockDismissLastAdded = vi.fn();

vi.mock("@/components/CartProvider", () => ({
  useCart: () => ({
    items: mockLastAddedItem
      ? [
          {
            ...mockLastAddedItem.item,
            quantity: mockLastAddedItem.quantityAdded,
          },
        ]
      : [],
    add: vi.fn(),
    changeQuantity: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    count: mockLastAddedItem ? mockLastAddedItem.quantityAdded : 0,
    subtotal: mockLastAddedItem
      ? mockLastAddedItem.item.pricePaise * mockLastAddedItem.quantityAdded
      : 0,
    sessionId: "mock-session-123",
    recoveryToken: null,
    isSyncing: false,
    lastAddedItem: mockLastAddedItem,
    dismissLastAdded: mockDismissLastAdded,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("AddToCartPrompt Component ('Small Thing' Added-to-Cart Modal/Toast)", () => {
  it("renders null when no item has been added", () => {
    mockLastAddedItem = null;
    mockPathname = "/shop";
    const html = renderToStaticMarkup(React.createElement(AddToCartPrompt));
    expect(html).toBe("");
  });

  it("renders null when user is on the /checkout route", () => {
    mockLastAddedItem = {
      id: "var-101-12345",
      item: {
        variantId: 101,
        slug: "darjeeling-spring-first-flush",
        name: "Darjeeling Spring First Flush",
        grams: 100,
        pricePaise: 129900,
        quantity: 1,
      },
      quantityAdded: 1,
      timestamp: Date.now(),
    };
    mockPathname = "/checkout";
    const html = renderToStaticMarkup(React.createElement(AddToCartPrompt));
    expect(html).toBe("");
  });

  it("renders the added notification card with product details and subtotal", () => {
    mockLastAddedItem = {
      id: "var-101-12345",
      item: {
        variantId: 101,
        slug: "darjeeling-spring-first-flush",
        name: "Darjeeling Spring First Flush",
        grams: 100,
        pricePaise: 129900,
        quantity: 1,
      },
      quantityAdded: 1,
      timestamp: Date.now(),
    };
    mockPathname = "/tea/darjeeling-spring-first-flush";

    const html = renderToStaticMarkup(React.createElement(AddToCartPrompt));

    // Assert container & role
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Added to bag notification"');
    expect(html).toContain('data-testid="add-to-cart-prompt"');

    // Assert header
    expect(html).toContain("Added to Bag");
    expect(html).toContain('aria-label="Close notification"');

    // Assert product details
    expect(html).toContain("Darjeeling Spring First Flush");
    expect(html).toContain("100g");

    // Assert bag summary
    expect(html).toContain("Bag subtotal");
    expect(html).toContain("(1 item):");

    // Assert screen reader accessible announcement
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain(
      "Darjeeling Spring First Flush added to your bag. Actions available: Proceed to checkout or Add more items."
    );
  });

  it("renders the primary 'Proceed to Checkout' action button linking to /checkout", () => {
    mockLastAddedItem = {
      id: "var-102-67890",
      item: {
        variantId: 102,
        slug: "assam-golden-tips",
        name: "Assam Golden Tips",
        grams: 250,
        pricePaise: 89900,
        quantity: 2,
      },
      quantityAdded: 2,
      timestamp: Date.now(),
    };
    mockPathname = "/shop";

    const html = renderToStaticMarkup(React.createElement(AddToCartPrompt));

    expect(html).toContain('data-testid="prompt-proceed-checkout"');
    expect(html).toContain('href="/checkout"');
    expect(html).toContain("Proceed to Checkout");
  });

  it("renders the secondary 'Add More Items' action button", () => {
    mockLastAddedItem = {
      id: "var-103-11111",
      item: {
        variantId: 103,
        slug: "giddapahar-oolong",
        name: "Giddapahar Estate Oolong",
        grams: 500,
        pricePaise: 249900,
        quantity: 1,
      },
      quantityAdded: 1,
      timestamp: Date.now(),
    };
    mockPathname = "/collections/oolong-tea";

    const html = renderToStaticMarkup(React.createElement(AddToCartPrompt));

    expect(html).toContain('data-testid="prompt-add-more-items"');
    expect(html).toContain("Add More Items");
  });

  it("renders the tertiary link to view the cart bag", () => {
    mockLastAddedItem = {
      id: "var-104-22222",
      item: {
        variantId: 104,
        slug: "silver-needle-white",
        name: "Himalayan Silver Needle White Tea",
        grams: 50,
        pricePaise: 159900,
        quantity: 1,
      },
      quantityAdded: 1,
      timestamp: Date.now(),
    };
    mockPathname = "/";

    const html = renderToStaticMarkup(React.createElement(AddToCartPrompt));

    expect(html).toContain('href="/cart"');
    expect(html).toContain("View Bag &amp; Order Summary");
  });

  it("renders wholesale indicator badge when item is wholesale", () => {
    mockLastAddedItem = {
      id: "var-105-33333",
      item: {
        variantId: 105,
        slug: "assam-bulk-lot",
        name: "Assam Orthodox Bulk Lot",
        grams: 1000,
        pricePaise: 14000,
        quantity: 100,
        isWholesale: true,
      },
      quantityAdded: 100,
      timestamp: Date.now(),
    };
    mockPathname = "/wholesale";

    const html = renderToStaticMarkup(React.createElement(AddToCartPrompt));

    expect(html).toContain("Wholesale");
    expect(html).toContain("1kg");
    expect(html).toContain("Qty: 100 ×");
  });
});
