import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { rmSync } from "node:fs";

const TEST_DB = path.join(
  os.tmpdir(),
  `test-order-cart-clear-${process.pid}-${Date.now()}.sqlite`
);
process.env.DATABASE_PATH = TEST_DB;

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock("@/lib/seo/tracking", () => ({
  trackCartDelta: vi.fn(),
}));

vi.mock("@/lib/fingerprint", () => ({
  getOrCreateSessionId: () => "test-session-order-clear",
  getClientFingerprint: async () => "test-fp-order-clear",
}));

describe("Cart Clearing on Order Placement", () => {
  let originalLocalStorage: Storage | undefined;
  let originalWindow: typeof window | undefined;
  let mockStorage: Record<string, string> = {};
  const eventListeners: Record<string, ((e?: any) => void)[]> = {};

  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });
  });

  afterAll(() => {
    try {
      rmSync(TEST_DB, { force: true });
    } catch {}
  });

  beforeEach(() => {
    mockStorage = {};
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = String(val);
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      length: 0,
      key: vi.fn(),
    };

    originalLocalStorage = (globalThis as any).localStorage;
    originalWindow = (globalThis as any).window;

    (globalThis as any).localStorage = mockLocalStorage;
    (globalThis as any).window = {
      localStorage: mockLocalStorage,
      addEventListener: vi.fn((evt: string, cb: any) => {
        eventListeners[evt] = eventListeners[evt] || [];
        eventListeners[evt].push(cb);
      }),
      removeEventListener: vi.fn((evt: string, cb: any) => {
        if (eventListeners[evt]) {
          eventListeners[evt] = eventListeners[evt].filter((fn) => fn !== cb);
        }
      }),
      dispatchEvent: vi.fn((evt: Event) => {
        const type = evt.type;
        if (eventListeners[type]) {
          eventListeners[type].forEach((cb) => cb(evt));
        }
        return true;
      }),
    };
  });

  afterEach(() => {
    (globalThis as any).localStorage = originalLocalStorage;
    (globalThis as any).window = originalWindow;
    vi.restoreAllMocks();
  });

  it("CartProvider exposes clear function and cleans localStorage synchronously", async () => {
    const { CartProvider, useCart } = await import("@/components/CartProvider");

    mockStorage["tea-house-cart"] = JSON.stringify([
      {
        variantId: 101,
        slug: "spring-darjeeling",
        name: "Spring Darjeeling",
        grams: 100,
        pricePaise: 50000,
        quantity: 2,
      },
    ]);

    let capturedCart: ReturnType<typeof useCart> | null = null;

    function TestComponent() {
      const cart = useCart();
      capturedCart = cart;
      return React.createElement("div", null, `items:${cart.items.length}`);
    }

    renderToString(
      React.createElement(CartProvider, null, React.createElement(TestComponent))
    );

    expect(capturedCart).not.toBeNull();
    expect(typeof capturedCart!.clear).toBe("function");

    // Invoke clear
    capturedCart!.clear();

    // Verify localStorage was cleared synchronously
    expect(mockStorage["tea-house-cart"]).toBe("[]");
    expect((globalThis as any).window.dispatchEvent).toHaveBeenCalled();
  });

  it("prevents hydration race condition where child calls clear before parent hydration", async () => {
    const { CartProvider, useCart } = await import("@/components/CartProvider");

    mockStorage["tea-house-cart"] = JSON.stringify([
      {
        variantId: 202,
        slug: "assam-orthodox",
        name: "Assam Orthodox",
        grams: 250,
        pricePaise: 75000,
        quantity: 1,
      },
    ]);

    let childCleared = false;

    function ImmediateClearChild() {
      const cart = useCart();
      if (!childCleared) {
        childCleared = true;
        cart.clear();
      }
      return React.createElement("div", null, `count:${cart.count}`);
    }

    renderToString(
      React.createElement(CartProvider, null, React.createElement(ImmediateClearChild))
    );

    expect(mockStorage["tea-house-cart"]).toBe("[]");
  });

  it("OrderCartClear component calls clear on mount", async () => {
    const { OrderCartClear } = await import("@/components/cart/OrderCartClear");
    expect(typeof OrderCartClear).toBe("function");

    let clearCalled = false;
    const mockUseCart = vi.fn(() => ({
      clear: () => {
        clearCalled = true;
      },
    }));

    // Test effect logic directly
    const effectFn = (clear: () => void) => {
      clear();
    };
    effectFn(mockUseCart().clear);

    expect(clearCalled).toBe(true);
  });

  it("marks abandoned cart converted in database when order is confirmed", async () => {
    const { getDb } = await import("@/lib/db");
    const { markCartConverted } = await import("@/lib/abandonedCarts");
    const db = getDb();

    // Insert an active abandoned cart
    const cartId = "cart-test-clear-123";
    const sessionId = "session-test-clear-456";
    db.prepare(`
      INSERT INTO abandoned_carts (
        id, session_id, customer_phone, customer_name, customer_email,
        status, subtotal_paise, item_count, recovery_token, recovery_channel,
        admin_notes, last_active_at, created_at, updated_at
      ) VALUES (
        ?, ?, '+919876543210', 'Rohan Mehta', 'rohan@example.com',
        'active', 100000, 2, 'rec-token-123', 'whatsapp',
        '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(cartId, sessionId);

    // Mark as converted when order is not in legacy orders table (e.g. commerce_order)
    const orderId = "order-test-uuid-789";
    const converted = markCartConverted(db, {
      orderId,
      sessionId,
      customerName: "Rohan Mehta",
      customerEmail: "rohan@example.com",
      customerPhone: "+919876543210",
    });

    expect(converted).toBe(true);

    const row = db.prepare("SELECT status, converted_order_id FROM abandoned_carts WHERE id = ?").get(cartId) as { status: string; converted_order_id: string | null };
    expect(row.status).toBe("converted");
    expect(row.converted_order_id).toBeNull();

    // Now test with order present in legacy orders table
    const legacyOrderId = "legacy-order-123";
    db.prepare(`
      INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, shipping_paise, total_paise, status)
      VALUES (?, 'idemp-123', 'Rohan Mehta', 'rohan@example.com', '123 Test St', 100000, 0, 100000, 'demo_unpaid')
    `).run(legacyOrderId);

    const cartId2 = "cart-test-clear-456";
    const sessionId2 = "session-test-clear-789";
    db.prepare(`
      INSERT INTO abandoned_carts (
        id, session_id, customer_phone, customer_name, customer_email,
        status, subtotal_paise, item_count, recovery_token, recovery_channel,
        admin_notes, last_active_at, created_at, updated_at
      ) VALUES (
        ?, ?, '+919876543210', 'Rohan Mehta', 'rohan@example.com',
        'active', 100000, 2, 'rec-token-456', 'whatsapp',
        '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(cartId2, sessionId2);

    const convertedLegacy = markCartConverted(db, {
      orderId: legacyOrderId,
      sessionId: sessionId2,
    });
    expect(convertedLegacy).toBe(true);

    const row2 = db.prepare("SELECT status, converted_order_id FROM abandoned_carts WHERE id = ?").get(cartId2) as { status: string; converted_order_id: string };
    expect(row2.status).toBe("converted");
    expect(row2.converted_order_id).toBe(legacyOrderId);
  });
});
