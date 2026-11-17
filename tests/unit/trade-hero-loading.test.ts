import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TradeHeroArt } from "@/components/trade/TradeHeroArt";

const effect = vi.hoisted(() => ({ run: undefined as undefined | (() => void | (() => void)) }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useEffect: (run: () => void) => { effect.run = run; } }));
vi.mock("next/image", () => ({ default: () => null }));

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("hero deferred loading recovery", () => {
  it("retries a hidden first load on visibility and avoids duplicate downloads", () => {
    vi.useFakeTimers();
    const documentMock = Object.assign(new EventTarget(), { readyState: "complete", visibilityState: "hidden" });
    const connection = Object.assign(new EventTarget(), { effectiveType: "4g", downlink: 10, saveData: false });
    const image = vi.fn(function () { return { src: "", onload: null }; });
    vi.stubGlobal("document", documentMock);
    vi.stubGlobal("navigator", { deviceMemory: 8, hardwareConcurrency: 8, connection });
    vi.stubGlobal("window", Object.assign(new EventTarget(), {
      Image: image, matchMedia: () => Object.assign(new EventTarget(), { matches: false }),
    }));
    renderToStaticMarkup(React.createElement(TradeHeroArt, { src: "/still.webp", alt: "Chai", hindi: false }));
    const cleanup = effect.run?.();
    vi.advanceTimersByTime(500);
    expect(image).not.toHaveBeenCalled();
    documentMock.visibilityState = "visible";
    documentMock.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(500);
    expect(image).toHaveBeenCalledTimes(1);
    connection.dispatchEvent(new Event("change"));
    vi.advanceTimersByTime(500);
    expect(image).toHaveBeenCalledTimes(1);
    if (cleanup) cleanup();
    documentMock.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(500);
    expect(image).toHaveBeenCalledTimes(1);
  });
});
