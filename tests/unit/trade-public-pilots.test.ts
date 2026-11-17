import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TradeSharedPilotRecord } from "@/lib/trade/catalogue";
import { publicTradePilots } from "@/lib/trade/publicPilots";
import { TradePilotLocations } from "@/components/trade/TradePilotLocations";

const pilot: TradeSharedPilotRecord = {
  id: "real", town_name: "Siliguri", collection_point: "Collection point", collection_address: "Market Road",
  pin_prefix: "734", local_fee_paise: 0, cutoff_at: "2026-12-01", dispatch_partner: "", dispatch_schedule: "",
  target_kg: 100, booked_kg: 0, status: "active", created_at: "", updated_at: "",
};
const render = (pilots: TradeSharedPilotRecord[], dict = {}) => renderToStaticMarkup(React.createElement(TradePilotLocations, { pilots, dict, onEnquire: () => {} }));
describe("public pilot locations", () => {
  it("removes E2E fixtures and inactive/incomplete entries while preserving real active locations", () => {
    expect(publicTradePilots([pilot, { ...pilot, id: "test", town_name: "Siliguri E2E Pilot" }, { ...pilot, id: "paused", status: "paused" }, { ...pilot, id: "missing", collection_address: " " }])).toEqual([pilot]);
  });
  it("deduplicates normalized locations without merging different addresses or mutating input", () => {
    const duplicate = { ...pilot, id: "second", town_name: " SILIGURI " };
    const different = { ...pilot, id: "other", collection_address: "Other Road" };
    expect(publicTradePilots([pilot, duplicate, different])).toEqual([pilot, different]);
    expect(duplicate.town_name).toBe(" SILIGURI ");
  });
  it("omits the section entirely when only fixtures exist", () => {
    expect(render([{ ...pilot, town_name: "Siliguri E2E Pilot" }])).toBe("");
    expect(render([])).toBe("");
  });
  it("uses one accessible enquiry action with a headed list of genuine locations", () => {
    const html = render([pilot, { ...pilot, id: "duplicate" }]);
    expect(html.match(/<li>/g)).toHaveLength(1);
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('aria-labelledby="pilotLocationsHeading"');
    expect(html).toContain("Ask about collection");
    expect(html).toContain("Market Road");
  });
  it("renders text passed from the published translation resource", () => {
    expect(render([pilot], { "ui.pilotEnquire": "कलेक्शन के बारे में पूछें" })).toContain("कलेक्शन के बारे में पूछें");
  });
});
