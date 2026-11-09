import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { campaignSchema, activeCampaign } from "@/lib/international/campaigns";

const TEST_DB = path.join(tmpdir(), `test-camp-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

describe("Regional Campaigns & Country Content Targeting", () => {
  let db: any;

  beforeAll(async () => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const { getDb } = await import("@/lib/db");
    db = getDb();
  });

  afterAll(() => {
    try { rmSync(TEST_DB, { force: true }); } catch {}
  });

  it("validates campaign schema correctly and enforces ends > starts", () => {
    const valid = {
      id: "a0000000-0000-4000-8000-000000000001",
      name: "Monsoon Darjeeling Special",
      countries: ["IN"],
      enabled: true,
      starts: 1000,
      ends: 2000,
      priority: 10,
      heroTitle: "Monsoon Harvest",
      heroDescription: "Freshly packed from the hills",
      heroImage: "/images/hero-monsoon.jpg",
      announcement: "Monsoon shipping perk",
      sliderIds: [1, 2],
      featuredIds: [10],
    };

    expect(campaignSchema.parse(valid)).toBeDefined();

    // Rejects if ends <= starts
    expect(() =>
      campaignSchema.parse({
        ...valid,
        starts: 2000,
        ends: 1000,
      })
    ).toThrow();
  });

  it("resolves active campaign based on country, schedule, and priority", () => {
    const now = 1700000000000;

    const baseCampaign1 = {
      id: "b0000000-0000-4000-8000-000000000001",
      name: "India Festive Campaign",
      countries: ["IN"],
      enabled: true,
      starts: now - 10000,
      ends: now + 10000,
      priority: 5,
      heroTitle: "Festive Season",
      heroDescription: "Special tea curation",
      heroImage: "/images/festive.jpg",
      announcement: "Diwali Special: Complimentary Tin",
      sliderIds: [],
      featuredIds: [],
    };

    const baseCampaign2 = {
      id: "b0000000-0000-4000-8000-000000000002",
      name: "India VIP Harvest",
      countries: ["IN"],
      enabled: true,
      starts: now - 10000,
      ends: now + 10000,
      priority: 15, // Higher priority
      heroTitle: "VIP Rare Harvest",
      heroDescription: "Limited release teas",
      heroImage: "/images/vip.jpg",
      announcement: "VIP Pre-Release",
      sliderIds: [],
      featuredIds: [],
    };

    const usCampaign = {
      id: "c0000000-0000-4000-8000-000000000001",
      name: "US Fall Harvest",
      countries: ["US"],
      enabled: true,
      starts: now - 10000,
      ends: now + 10000,
      priority: 10,
      heroTitle: "Autumn in America",
      heroDescription: "Delivered direct from Himalayas",
      heroImage: "/images/us.jpg",
      announcement: "Free US Shipping above $50",
      sliderIds: [],
      featuredIds: [],
    };

    db.prepare("INSERT INTO commerce_campaigns (id, document) VALUES (?, ?)").run(
      baseCampaign1.id,
      JSON.stringify(baseCampaign1)
    );
    db.prepare("INSERT INTO commerce_campaigns (id, document) VALUES (?, ?)").run(
      baseCampaign2.id,
      JSON.stringify(baseCampaign2)
    );
    db.prepare("INSERT INTO commerce_campaigns (id, document) VALUES (?, ?)").run(
      usCampaign.id,
      JSON.stringify(usCampaign)
    );

    // India resolves the higher priority campaign (priority 15)
    const inActive = activeCampaign("IN", now);
    expect(inActive?.id).toBe(baseCampaign2.id);
    expect(inActive?.heroTitle).toBe("VIP Rare Harvest");

    // US resolves US campaign
    const usActive = activeCampaign("US", now);
    expect(usActive?.id).toBe(usCampaign.id);

    // Other country has no active campaign
    const frActive = activeCampaign("FR", now);
    expect(frActive).toBeNull();

    // Expired campaign is not active
    const expiredActive = activeCampaign("IN", now + 20000);
    expect(expiredActive).toBeNull();
  });
});
