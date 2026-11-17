import { describe, expect, it } from "vitest";
import { canAnimateTradeHero, type AnimationDevice } from "@/lib/trade/heroAnimation";

const capable: AnimationDevice = { deviceMemory: 4, hardwareConcurrency: 4, connection: { effectiveType: "4g", downlink: 5, saveData: false } };
describe("optional tea shop hero animation", () => {
  it("allows devices with reported memory, CPUs and fast network", () => {
    expect(canAnimateTradeHero(capable, false)).toBe(true);
  });
  it("honors reduced motion and Data Saver", () => {
    expect(canAnimateTradeHero(capable, true)).toBe(false);
    expect(canAnimateTradeHero({ ...capable, connection: { ...capable.connection, saveData: true } }, false)).toBe(false);
  });
  it.each<AnimationDevice>([
    {}, { ...capable, deviceMemory: undefined }, { ...capable, deviceMemory: 2 },
    { ...capable, hardwareConcurrency: 2 }, { ...capable, connection: undefined },
    { ...capable, connection: { effectiveType: "3g", downlink: 5 } },
    { ...capable, connection: { effectiveType: "4g", downlink: 1.5 } },
  ])("retains the still when capability is inadequate or unknown: %j", (device) => {
    expect(canAnimateTradeHero(device, false)).toBe(false);
  });
});
