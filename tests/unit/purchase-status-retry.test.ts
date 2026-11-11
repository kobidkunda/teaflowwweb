import { afterEach, beforeEach, expect, it, vi } from "vitest";
import React, { type ReactElement, type ReactNode } from "react";

const harness = vi.hoisted(() => ({
  states: [] as unknown[], index: 0, effects: [] as Array<() => unknown>,
  purchase: vi.fn(), refresh: vi.fn(), clear: vi.fn(),
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = harness.index++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = value; }];
  },
  useEffect: (effect: () => unknown) => { harness.effects.push(effect); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("@/lib/seo/tracking", () => ({ trackPurchase: harness.purchase }));
vi.mock("@/components/CartProvider", () => ({ useCart: () => ({ clear: harness.clear }) }));
import { PurchaseStatus } from "@/components/international/PurchaseStatus";

const analytics = { value: 30, total: 30, shipping: 0, tax: 0, currency: "INR", items: [{ item_id: "TFW-005-100G", item_name: "Chai", price: 30, quantity: 1 }] };
function render() {
  harness.index = 0; harness.effects = [];
  return PurchaseStatus({ id: "order-1", token: "test-token", initial: "payment_pending", analytics });
}
function buttons(node: ReactNode): ReactElement<{ onClick: () => Promise<void>; children?: ReactNode }>[] {
  if (!React.isValidElement<{ children?: ReactNode }>(node)) return [];
  return [
    ...(node.type === "button" ? [node as ReactElement<{ onClick: () => Promise<void> }>] : []),
    ...React.Children.toArray(node.props.children).flatMap(buttons),
  ];
}
beforeEach(() => {
  harness.states = []; harness.purchase.mockClear(); harness.refresh.mockClear(); harness.clear.mockClear();
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("waits for server confirmation after the Razorpay browser callback before tracking Purchase", async () => {
  let onGatewaySuccess: (() => void) | undefined;
  Object.assign(window, { Razorpay: class {
    constructor(options: { handler: () => void }) { onGatewaySuccess = options.handler; }
    open() { onGatewaySuccess?.(); }
  } });
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ gateway: "razorpay", keyId: "test", gatewayOrderId: "gateway-1" }) });
  vi.stubGlobal("fetch", fetchMock);
  const tree = render();
  harness.effects[0]();
  expect(harness.purchase).not.toHaveBeenCalled();
  await buttons(tree).at(-1)!.props.onClick();
  render(); harness.effects[0]();
  expect(harness.states[0]).toBe("payment_pending");
  expect(harness.purchase).not.toHaveBeenCalled();
  expect(harness.refresh).toHaveBeenCalledOnce();

  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ paymentStatus: "paid", tracking: null }) });
  const cleanup = harness.effects[1]() as () => void;
  await vi.advanceTimersByTimeAsync(0);
  render(); harness.effects[0]();
  expect(harness.states[0]).toBe("paid");
  expect(harness.purchase).toHaveBeenCalledExactlyOnceWith("order-1", 30, 0, 0, analytics.items, "INR", 30);
  cleanup();
});
