import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStarterSamples } from "@/lib/business/starterSamples";
const { listPublic } = vi.hoisted(() => ({ listPublic: vi.fn() }));
vi.mock("@/lib/trials/service", () => ({ TrialService: { listPublic } }));
describe("starter sample catalogue boundary", () => {
  beforeEach(() => listPublic.mockReset());
  it("requests only published public catalogue data", () => {
    listPublic.mockReturnValue({ trials: [], total: 0 });
    expect(getStarterSamples()).toEqual({ trials: [], error: false });
    expect(listPublic).toHaveBeenCalledWith({ limit: 3, offset: 0, sort_by: "published_at", sort_dir: "desc" });
  });
  it("does not expose database errors", () => {
    listPublic.mockReturnValue({ get trials() { throw new Error("private database details"); } });
    expect(getStarterSamples()).toEqual({ trials: [], error: true });
  });
});
