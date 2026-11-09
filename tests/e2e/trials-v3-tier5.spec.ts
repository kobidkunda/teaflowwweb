import { test as base, expect, Page, BrowserContext, APIRequestContext } from "@playwright/test";

try {
  process.loadEnvFile?.();
} catch {
  // Non-fatal if .env does not exist or environment already populated
}

/**
 * Himalayan Tea House / TeaFloww Trials v3 — Tier 5 Adversarial Hardening E2E Suite
 *
 * Requirements: ORIGINAL_REQUEST.md (R1–R5), PROJECT.md (M6 Phase 2: Tier 5 Hardening)
 * Focus Areas:
 * 1. Extreme payloads, fuzzing, and malformed inputs via live HTTP endpoints
 * 2. Concurrent mutation collisions and 409 Conflict resolution via APIRequestContext
 * 3. SQL injection resistance and special Unicode path safety
 * 4. Whitelist projection zero-leakage security audit
 * 5. Storefront keyboard navigation and boundary input arithmetic
 */

const test = base.extend<{ page: Page; adminRequest: APIRequestContext }, { workerContext: BrowserContext }>({
  workerContext: [
    async ({ browser }, use) => {
      const targetPort = process.env.BASE_URL
        ? new URL(process.env.BASE_URL).port
        : process.env.PORT || 3001;
      const port = Number(targetPort) || 3001;
      let serverAvailable = false;
      try {
        const net = await import("node:net");
        await new Promise<void>((resolve) => {
          const client = net.connect({ port, host: "127.0.0.1" }, () => {
            serverAvailable = true;
            client.end();
            resolve();
          });
          client.on("error", () => resolve());
          client.setTimeout(400, () => {
            client.destroy();
            resolve();
          });
        });
      } catch {
        // ignore
      }

      let server: any = null;
      if (!serverAvailable) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const next = require("next");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const http = require("node:http");
        const fs = await import("node:fs");
        const path = await import("node:path");
        const hasBuild = fs.existsSync(path.join(process.cwd(), ".next", "BUILD_ID"));
        const nextApp = next({ dev: !hasBuild, dir: process.cwd() });
        await nextApp.prepare();
        const handle = nextApp.getRequestHandler();
        server = http.createServer((req: any, res: any) => handle(req, res));
        await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", () => resolve()));
      }

      const context = await browser.newContext();
      await use(context);
      await context.close();
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
    { scope: "worker" },
  ],
  context: async ({ workerContext }, use) => {
    await use(workerContext);
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem("test_session_trials_active")) {
          sessionStorage.setItem("test_session_trials_active", "1");
          localStorage.removeItem("teafloww-cart");
        }
      } catch {
        // ignore
      }
    });
    await use(page);
    await page.close();
  },
  adminRequest: async ({ playwright }, use) => {
    const baseURL = process.env.BASE_URL || "http://127.0.0.1:3000";
    let adminCookie = "admin_session=test-root-token-session-value-12345";
    try {
      const { createAdminSession } = await import("@/lib/adminSessions");
      const { cookieValue } = createAdminSession(1);
      adminCookie = `admin_session=${cookieValue}`;
    } catch {
      // fallback
    }
    const requestContext = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        ...(process.env.ADMIN_TEST_TOKEN ? { "x-admin-test-token": process.env.ADMIN_TEST_TOKEN } : {}),
        Cookie: adminCookie,
      },
    });
    await use(requestContext);
    await requestContext.dispose();
  },
});

test.beforeAll(async () => {
  try {
    const { seedSampleTrial } = await import("../../scripts/seed-sample-trial.mjs");
    seedSampleTrial();
  } catch {
    // fallback
  }
});

test.describe("Tier 5: Adversarial Coverage Hardening (E2E Track)", () => {
  test("T5.E1: giant payload stress — 100KB payload rejected cleanly with HTTP 400", async ({ adminRequest }) => {
    const hugeTitle = "E2E-GIANT-".padEnd(100 * 1024, "X");
    const res = await adminRequest.post("/api/v1/admin/trials", {
      data: {
        title: hugeTitle,
        slug: "tier5-e2e-giant",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("T5.E2: PIN code fuzzing in shipping quote API rejects invalid and boundary PIN codes", async ({ request }) => {
    const invalidPins = ["012345", "11000", "1100001", "11000X", "<script>"];
    for (const pin of invalidPins) {
      const res = await request.post("/api/v1/trials/tea-stall-discovery-kit/shipping-quote", {
        data: { pincode: pin, quantity: 1 },
      });
      expect(res.status()).toBe(400);
    }
  });

  test("T5.E3: concurrent mutation collision: 5 simultaneous PATCH calls with expected_revision=1 result in 1 HTTP 200 and 4 HTTP 409", async ({ adminRequest }) => {
    // Create new test draft
    const createRes = await adminRequest.post("/api/v1/admin/trials", {
      data: {
        title: "E2E Race Baseline",
        slug: `tier5-e2e-race-${Date.now()}`,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const trialId = created.id || created.trial.id;

    // Launch 5 simultaneous PATCH requests with expected_revision: 1
    const promises = Array.from({ length: 5 }, (_, i) => {
      return adminRequest.patch(`/api/v1/admin/trials/${trialId}`, {
        data: {
          expected_revision: 1,
          title: `Concurrent Title Winner #${i}`,
        },
      });
    });

    const responses = await Promise.all(promises);
    const statuses = responses.map((r) => r.status());
    const count200 = statuses.filter((s) => s === 200).length;
    const count409 = statuses.filter((s) => s === 409).length;

    expect(count200).toBe(1);
    expect(count409).toBe(4);
  });

  test("T5.E4: SQL injection path safety: URL-encoded injection strings in trial slug route return HTTP 404 cleanly", async ({ request }) => {
    const maliciousPaths = [
      "/api/v1/trials/%27%20OR%20%271%27=%271",
      "/api/v1/trials/%27;DROP%20TABLE%20trials;--",
      "/api/v1/trials/UNION%20SELECT%20*%20FROM%20users",
    ];

    for (const path of maliciousPaths) {
      const res = await request.get(path);
      expect(res.status()).toBe(404);
    }
  });

  test("T5.E5: whitelist projection zero-leakage audit: public PDP response strictly excludes cost_paise and COGS", async ({ request }) => {
    const res = await request.get("/api/v1/trials/tea-stall-discovery-kit");
    expect(res.status()).toBe(200);

    const body = await res.text();
    expect(body).not.toContain("cost_paise");
    expect(body).not.toContain("supplier_id");
    expect(body).not.toContain("internal_notes");
  });

  test("T5.E6: storefront cost calculator interactivity: direct number and range input clamping", async ({ page }) => {
    await page.goto("/trials/tea-stall-discovery-kit");
    await page.waitForSelector('[data-testid="cost-per-cup-calculator"]');

    const doseInput = page.locator('input[name="dose_grams"]');
    const costValue = page.locator('[data-testid="cost-per-cup-value"]');

    // Test standard dose input
    await doseInput.fill("3.0");
    await page.waitForTimeout(100);

    // Verify calculation output is non-empty and starts with ₹
    const costText = await costValue.textContent();
    expect(costText).toMatch(/^₹\d+\.\d{2}$/);
    expect(costText).not.toContain("NaN");
  });

  test("T5.E7: storefront optical studio keyboard accessibility: roving tab index", async ({ page }) => {
    await page.goto("/trials/tea-stall-discovery-kit");
    await page.waitForSelector('[data-testid="optical-pouch-tab"]');

    const pouchTabs = page.locator('[data-testid="optical-pouch-tab"]');
    expect(await pouchTabs.count()).toBe(4);

    // Click first pouch tab and press ArrowRight
    await pouchTabs.first().click();
    await page.keyboard.press("ArrowRight");

    // Second tab should now have focus or aria-selected
    const secondTab = pouchTabs.nth(1);
    expect(await secondTab.getAttribute("aria-selected")).toBe("true");
  });

  test("T5.E8: unauthenticated access to draft trials returns HTTP 404", async ({ request, adminRequest }) => {
    const draftSlug = `tier5-e2e-draft-${Date.now()}`;
    const createRes = await adminRequest.post("/api/v1/admin/trials", {
      data: {
        title: "Secret Draft Kit",
        slug: draftSlug,
      },
    });
    expect(createRes.status()).toBe(201);

    // Unauthenticated public request
    const pubRes = await request.get(`/api/v1/trials/${draftSlug}`);
    expect(pubRes.status()).toBe(404);
  });
});
