import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB = path.join(tmpdir(), `test-trans-mcp-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

describe("Model Context Protocol (MCP) Translations & Translation Studio Parity", () => {
  let dispatchToolCall: (name: unknown, args: unknown) => any;
  let dispatchResourceRead: (uri: string) => any;
  let listToolDefinitions: () => any[];

  beforeAll(async () => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const mcpModule = await import("@/lib/mcp");
    dispatchToolCall = mcpModule.dispatchToolCall;
    dispatchResourceRead = mcpModule.dispatchResourceRead;
    listToolDefinitions = mcpModule.listToolDefinitions;
  });

  afterAll(() => {
    for (const suffix of ["", "-shm", "-wal", "-journal"]) {
      try { rmSync(TEST_DB + suffix, { force: true }); } catch {}
    }
  });

  it("registers translation tools in MCP tool registry", () => {
    const tools = listToolDefinitions();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain("translations.getLocales");
    expect(toolNames).toContain("translations.list");
    expect(toolNames).toContain("translations.get");
    expect(toolNames).toContain("translations.update");
    expect(toolNames).toContain("translations.publish");
    expect(toolNames).toContain("translations.unpublish");
    expect(toolNames).toContain("translations.queue");
    expect(toolNames).toContain("translations.seedPanIndia");
    expect(toolNames).toContain("translations.bulkPublish");
  });

  it("translations.getLocales returns supported languages including Pan-India locales", () => {
    const res = dispatchToolCall("translations.getLocales", {});
    expect(res.locales).toBeInstanceOf(Array);
    expect(res.locales.length).toBeGreaterThanOrEqual(8);
    const hi = res.locales.find((l: any) => l.code === "hi");
    expect(hi).toBeDefined();
    expect(hi.isPanIndia).toBe(true);

    const bn = res.locales.find((l: any) => l.code === "bn");
    expect(bn).toBeDefined();
    expect(bn.isPanIndia).toBe(true);
  });

  it("translations.seedPanIndia seeds and publishes standard Pan-India dictionaries", () => {
    const res = dispatchToolCall("translations.seedPanIndia", {
      locales: ["hi", "bn", "pa"],
      publish: true,
      resource: "interface",
    });

    expect(res.ok).toBe(true);
    expect(res.seededCount).toBe(3);
    expect(res.published).toBe(true);

    // Verify through translations.get
    const getHi = dispatchToolCall("translations.get", { resource: "interface", locale: "hi" });
    expect(getHi.status).toBe("published");
    expect(getHi.published).toBeDefined();
    expect(getHi.published.nav_shop).toBe("चाय खरीदें");
  });

  it("translations.list lists resources and supports type and status filtering", () => {
    const listRes = dispatchToolCall("translations.list", { locale: "hi" });
    expect(listRes.resources).toBeInstanceOf(Array);
    expect(listRes.counts).toBeDefined();
    expect(listRes.counts.total).toBeGreaterThan(0);

    const interfaceItem = listRes.resources.find((r: any) => r.resource === "interface");
    expect(interfaceItem).toBeDefined();
    expect(interfaceItem.status).toBe("published");

    // Filter by type
    const productsOnly = dispatchToolCall("translations.list", { locale: "hi", type: "product" });
    expect(productsOnly.resources.every((r: any) => r.type === "product")).toBe(true);
  });

  it("translations.update validates tokens and creates drafts", () => {
    // Attempt XSS
    expect(() =>
      dispatchToolCall("translations.update", {
        resource: "interface",
        locale: "hi",
        texts: { deliver: "डिलीवर <script>alert(1)</script>" },
      })
    ).toThrow();

    // Valid update
    const updateRes = dispatchToolCall("translations.update", {
      resource: "interface",
      locale: "hi",
      texts: { deliver: "घर तक डिलीवरी" },
    });
    expect(updateRes.ok).toBe(true);
    expect(updateRes.status).toBe("draft");

    const getRes = dispatchToolCall("translations.get", { resource: "interface", locale: "hi" });
    expect(getRes.draft.deliver).toBe("घर तक डिलीवरी");
  });

  it("translations.publish publishes draft and updates live state", () => {
    const pubRes = dispatchToolCall("translations.publish", {
      resource: "interface",
      locale: "hi",
    });
    expect(pubRes.ok).toBe(true);
    expect(pubRes.status).toBe("published");

    const getRes = dispatchToolCall("translations.get", { resource: "interface", locale: "hi" });
    expect(getRes.status).toBe("published");
    expect(getRes.published.deliver).toBe("घर तक डिलीवरी");
  });

  it("translations.unpublish unpublishes live translation", () => {
    const unpubRes = dispatchToolCall("translations.unpublish", {
      resource: "interface",
      locale: "hi",
    });
    expect(unpubRes.ok).toBe(true);

    const getRes = dispatchToolCall("translations.get", { resource: "interface", locale: "hi" });
    expect(getRes.published).toBeNull();
  });

  it("supports aliases across snake_case, dot notation and admin.* prefixes", () => {
    // list_translations alias
    const listRes = dispatchToolCall("list_translations", { locale: "bn" });
    expect(listRes.resources).toBeInstanceOf(Array);

    // admin.publishTranslation alias with direct texts
    const pubRes = dispatchToolCall("admin.publishTranslation", {
      resource: "interface",
      locale: "bn",
      texts: { deliver: "ডেলিভারি ঠিকানা" },
    });
    expect(pubRes.ok).toBe(true);
    expect(pubRes.status).toBe("published");

    // translations.publishReviewed alias with reviewed=false rejection and revision guard
    expect(() =>
      dispatchToolCall("translations.publishReviewed", {
        resource: "interface",
        locale: "bn",
        reviewed: false,
        texts: { deliver: "ডেলিভারি ঠিকানা" },
      })
    ).toThrow(/reviewed/i);

    expect(() =>
      dispatchToolCall("translations.publishReviewed", {
        resource: "interface",
        locale: "bn",
        expected_revision: 999999,
        reviewed: true,
        texts: { deliver: "ডেলিভারি ঠিকানা" },
      })
    ).toThrow(/revision/i);

    const revRes = dispatchToolCall("translations.publishReviewed", {
      resource: "interface",
      locale: "bn",
      expected_revision: pubRes.revision,
      reviewed: true,
      texts: { deliver: "ডেলিভারি ঠিকানা" },
    });
    expect(revRes.ok).toBe(true);
    expect(revRes.status).toBe("published");
  });

  it("exposes MCP resources tea://translations/overview and tea://translations/studio", () => {
    const overview = dispatchResourceRead("tea://translations/overview");
    expect(overview.contents).toBeDefined();
    const overviewJson = JSON.parse(overview.contents[0].text);
    expect(overviewJson.locales).toBeInstanceOf(Array);
    expect(overviewJson.panIndiaLocales).toContain("hi");
    expect(overviewJson.totalResources).toBeGreaterThan(0);

    const studioRes = dispatchResourceRead("tea://translations/studio");
    expect(studioRes.contents).toBeDefined();
    const studioJson = JSON.parse(studioRes.contents[0].text);
    expect(studioJson.resources).toBeInstanceOf(Array);
  });

  it("translations.queue enforces non-English, max 25, deduplication, and skips existing unless force=true", () => {
    const failsCode = (name: string, args: unknown) => {
      try {
        dispatchToolCall(name, args);
        return null;
      } catch (err: any) {
        return err?.code ?? null;
      }
    };

    expect(failsCode("translations.list", { locale: "xx" })).toBe(-32602);
    expect(failsCode("translations.queue", { locale: "en", resources: ["interface"] })).toBe(-32602);
    expect(failsCode("translations.queue", { locale: "gu", resources: ["interface", "interface"] })).toBe(-32602);
    expect(
      failsCode("translations.queue", {
        locale: "gu",
        resources: Array.from({ length: 26 }, (_, i) => `product:${i + 1}`),
      })
    ).toBe(-32602);

    // interface is missing for gu -> queues; unknown resource -> skipped
    const q1 = dispatchToolCall("translations.queue", {
      locale: "gu",
      resources: ["interface", "nonexistent:999"],
    });
    expect(q1.ok).toBe(true);
    expect(q1.queued).toBe(1);
    expect(q1.queuedResources).toEqual(["interface"]);
    expect(q1.skipped).toEqual([{ resource: "nonexistent:999", reason: "Unknown resource" }]);

    // bn interface was published in earlier test -> skipped unless force=true
    const qSkipped = dispatchToolCall("translations.queue", {
      locale: "bn",
      resources: ["interface"],
    });
    expect(qSkipped.queued).toBe(0);
    expect(qSkipped.skipped[0]?.resource).toBe("interface");

    const qForced = dispatchToolCall("translations.queue", {
      locale: "bn",
      resources: ["interface"],
      force: true,
    });
    expect(qForced.queued).toBe(1);
    expect(qForced.queuedResources).toEqual(["interface"]);
  });
});
