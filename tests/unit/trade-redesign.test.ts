import { tradeDefaults } from "@/lib/trade/baseCopy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db";
import {
  editTranslation,
  sourceFor,
  resourceList,
  validateTexts,
} from "@/lib/international/translations";
import { getTradeDictionary } from "@/lib/trade/i18n";
import { dispatchToolCall } from "@/lib/mcp";
import { createTradeEnquiry } from "@/lib/trade/quotes";
import { listAdminResponses } from "@/lib/admin/responses";
import { tradeImage } from "@/lib/trade/media";
const directory = mkdtempSync(path.join(tmpdir(), "trade-redesign-"));
const previous = process.env.DATABASE_PATH;
beforeAll(() => {
  process.env.DATABASE_PATH = path.join(directory, "store.sqlite");
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    env: process.env,
    stdio: "ignore",
  });
});
afterAll(() => {
  process.env.DATABASE_PATH = previous;
  rmSync(directory, { recursive: true, force: true });
});
describe("Tea shop redesign operations", () => {
  it("keeps every supplied Hindi and regional default publishable without changing protected values", () => {
    const source = sourceFor("trade");
    for (const loc of ["hi", "bn", "gu", "mr", "pa", "ta", "te"] as const) {
      const defaults = tradeDefaults(loc);
      const failures: string[] = [];
      for (const [key, value] of Object.entries(source)) {
        try {
          validateTexts({ [key]: value }, { [key]: defaults[key] || value });
        } catch {
          failures.push(`${loc}:${key}`);
        }
      }
      expect(failures).toEqual([]);
    }
  });
  it("publishes the same page/checkout/calculator resource through Studio and MCP, preserving drafts", () => {
    expect(resourceList().some((row) => row.resource === "trade")).toBe(true);
    expect(sourceFor("trade")).toHaveProperty("ui.finalReviewBody");
    editTranslation(
      "trade",
      { "hero.title": "मेरी दुकान की चाय" },
      "draft",
      "hi",
    );
    expect(getTradeDictionary("hi")["hero.title"]).not.toBe(
      "मेरी दुकान की चाय",
    );
    editTranslation("trade", {}, "publish", "hi");
    expect(getTradeDictionary("hi")["hero.title"]).toBe("मेरी दुकान की चाय");
    dispatchToolCall("translations.publish", {
      resource: "trade",
      locale: "hi",
      texts: { "ui.pay": "भुगतान करें", "calc.demand": "चाय की ज़रूरत" },
    });
    const dict = getTradeDictionary("hi");
    expect(dict["ui.pay"]).toBe("भुगतान करें");
    expect(dict["calc.demand"]).toBe("चाय की ज़रूरत");
    expect(dict["ui.consent"]).toContain("सहमत");
    expect(() =>
      editTranslation(
        "trade",
        { "ui.pay": "<script>bad</script>" },
        "publish",
        "hi",
      ),
    ).toThrow();
    expect(getTradeDictionary("hi")["ui.pay"]).toBe("भुगतान करें");
  });
  it("can edit English page content and invalidate stale published copies", () => {
    dispatchToolCall("translations.publish", { resource: "trade", locale: "en", texts: { "hero.title": "Tea chosen for your counter" } });
    expect(getTradeDictionary("en")["hero.title"]).toBe(
      "Tea chosen for your counter",
    );
    getDb()
      .prepare(
        "UPDATE commerce_translations SET published_hash='old' WHERE resource='trade' AND locale='en'",
      )
      .run();
    expect(getTradeDictionary("en")["hero.title"]).not.toBe(
      "Tea chosen for your counter",
    );
  });
  it("persists a Hindi lead once and exposes it in the unified responses inbox", () => {
    const input = {
      idempotencyKey: "ritual-lead-repeat-123",
      locale: "hi",
      destinationPin: "734005",
      contactName: "Local Test Tea Counter",
      contactPhone: "+919000000001",
      consentGiven: true,
      enquiryType: "trial",
      whatsappDraft: "ट्रायल के बारे में पूछताछ",
      ctaSource: "trade_modal",
    };
    const result = createTradeEnquiry(input, "local-ritual-session");
    const repeated = createTradeEnquiry(input, "local-ritual-session");
    expect(repeated.deduped).toBe(true);
    const id = String((result.enquiry as Record<string, unknown>).id);
    const inbox = listAdminResponses({
      type: "bulk_order",
      q: "Local Test Tea Counter",
      limit: 20,
    });
    const row = inbox.items.find((item) => item.reference === id);
    expect(row?.phone).toBe(input.contactPhone);
    expect(row?.payload.locale).toBe("hi");
    expect(row?.deepLink).toBe("/admin/trade");
    expect(result.whatsappUrl).toContain("wa.me");
    expect(
      getDb()
        .prepare("SELECT COUNT(*) AS count FROM trade_enquiries WHERE id=?")
        .get(id),
    ).toEqual({ count: 1 });
  });
  it("upgrades starter art while preserving operator images and MCP round trips", () => {
    expect(
      tradeImage("/images/trials/discovery-shelf-hero.webp", "hero"),
    ).toContain("counter-ritual-hero");
    expect(tradeImage("/uploads/approved-pouches.webp", "trial")).toBe(
      "/uploads/approved-pouches.webp",
    );
    dispatchToolCall("trade.updateSettings", {
      hero_image_url: "/uploads/approved-counter.webp",
      trial_image_url: "/uploads/approved-pouches.webp",
    });
    const overview = dispatchToolCall("trade.getOverview", {}) as {
      settings: { hero_image_url: string; trial_image_url: string };
    };
    expect(overview.settings.hero_image_url).toBe(
      "/uploads/approved-counter.webp",
    );
    expect(overview.settings.trial_image_url).toBe(
      "/uploads/approved-pouches.webp",
    );
  });
});
