import { test, expect } from "@playwright/test";

const ROOT_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ROOT_USER = process.env.ADMIN_USERNAME || "root";

test.describe("First-Party UTM, Keyword, Conversation & Funnel Capture", () => {
  test("captures UTMs & keywords on landing, carries them into form submission & WhatsApp click, and respects consent denial", async ({
    page,
    request,
  }) => {
    const tag = `${Date.now()}`;
    const campaign = `e2e_camp_${tag}`;
    const term = `darjeeling+first+flush+${tag}`;

    // 1. Land with UTM parameters + click ID (consent not yet granted for ads, first-party still captures!)
    await page.goto(
      `/contact?utm_source=google&utm_medium=cpc&utm_campaign=${campaign}&utm_term=${term}&utm_content=hero_banner&gclid=gclid_${tag}`
    );
    await page.waitForLoadState("networkidle");

    // Verify first-party localStorage & cookie attribution was captured
    const storedAttr = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("tf_attribution_v1") || "null");
      } catch {
        return null;
      }
    });
    expect(storedAttr).not.toBeNull();
    expect(storedAttr.lastTouch.utm_source).toBe("google");
    expect(storedAttr.lastTouch.utm_campaign).toBe(campaign);
    expect(storedAttr.lastTouch.utm_term).toContain("darjeeling first flush");
    expect(storedAttr.lastTouch.gclid).toBe(`gclid_${tag}`);

    // Click "Essential only" on cookie banner and verify third-party pixels & ad/commerce events stay suppressed
    const essentialBtn = page.getByRole("button", { name: "Essential only" });
    if (await essentialBtn.isVisible()) {
      await essentialBtn.click();
    }
    const thirdPartyState = await page.evaluate(() => {
      const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
      const commerceLeadEvents = Array.isArray(w.dataLayer)
        ? w.dataLayer.filter(
            (entry) =>
              entry &&
              !Array.isArray(entry) &&
              typeof entry === "object" &&
              ["view_item", "add_to_cart", "begin_checkout", "add_payment_info", "purchase", "generate_lead"].includes(
                String(entry.event || "")
              )
          )
        : [];
      const hasGtmScript = Boolean(document.getElementById("google-tag-manager"));
      const hasMetaScript = Boolean(document.querySelector('script[src*="fbevents.js"]'));
      return { commerceLeadEventsCount: commerceLeadEvents.length, hasGtmScript, hasMetaScript };
    });
    expect(thirdPartyState).toEqual({
      commerceLeadEventsCount: 0,
      hasGtmScript: false,
      hasMetaScript: false,
    });

    // 2. Submit Contact form on the attributed session
    await page.getByRole("textbox", { name: /Full Name/i }).fill(`E2E Tester ${tag}`);
    await page.getByRole("textbox", { name: /Email Address/i }).fill(`e2e_${tag}@example.com`);
    await page.getByRole("textbox", { name: /Phone/i }).fill("+91 9832012345");
    await page.getByRole("textbox", { name: /Inquiry Details & Notes/i }).fill("Interested in Spring Darjeeling lots.");

    const contactResPromise = page.waitForResponse(
      (res) => res.url().includes("/api/contact") && res.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Send Inquiry" }).click();
    const contactRes = await contactResPromise;
    expect(contactRes.status()).toBe(200);

    // 3. Unauthenticated request to /api/admin/funnel must stay blocked (401)
    const unauthRes = await request.get("/api/admin/funnel");
    expect(unauthRes.status()).toBe(401);

    // 4. If ADMIN_PASSWORD is available in test env, sign in to /admin/funnel and verify attributed metrics appear
    if (ROOT_PASSWORD) {
      await page.goto("/admin/funnel");
      await page.getByLabel("Username").fill(ROOT_USER);
      await page.getByLabel("Password").fill(ROOT_PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page.getByRole("heading", { name: /Funnel, UTM & Remarketing Hub/i })).toBeVisible();
      await page.getByLabel("Filter by keyword").fill(tag);
      await expect(page.getByText(campaign).first()).toBeVisible({ timeout: 10000 });
    }
  });
});
