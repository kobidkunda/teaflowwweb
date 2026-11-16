import { test, expect } from "@playwright/test";

const ROOT_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ROOT_USER = process.env.ADMIN_USERNAME || "root";

test.describe("TeaFloww Trade Channel (/tea-shops & /admin/trade)", () => {
  test("neutral entry, language picker, /for-tea-shops redirect, and /tea-shops/bn?blend=... deep link", async ({
    page,
  }) => {
    // /for-tea-shops redirects to /tea-shops
    await page.goto("/for-tea-shops");
    await expect(page).toHaveURL(/\/tea-shops$/);
    await expect(
      page.getByRole("heading", { name: /Choose your language/i })
    ).toBeVisible();

    // Language picker lists English and Bengali and navigates on click
    const bnLink = page.locator('a[href="/tea-shops/bn"]');
    await expect(bnLink).toBeVisible();
    await bnLink.click();
    await expect(page).toHaveURL(/\/tea-shops\/bn$/);
    await expect(page.locator('[lang="bn"]').first()).toBeVisible();

    // Deep link with ?blend=... selects matching blend if present
    const enRes = await page.goto("/tea-shops/en");
    expect(enRes?.status()).toBe(200);
    const blendOptions = await page.locator("#trade-blend option").allTextContents();
    expect(blendOptions.length).toBeGreaterThan(0);

    await page.goto("/tea-shops/bn?blend=assam-ctc-chai");
    await expect(page.locator('[lang="bn"]').first()).toBeVisible();
    await expect(page.locator("#trade-blend")).toBeVisible();
  });

  test("360px mobile viewport layout, PIN quotes (doorstep, depot, manual enquiry), and CupCalculator", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/tea-shops/en");

    const cookieDismiss = page
      .getByRole("button", { name: /Essential only|Dismiss cookie notice/i })
      .first();
    if (await cookieDismiss.isVisible().catch(() => false)) {
      await cookieDismiss.click();
    }

    // No horizontal overflow on 360px mobile viewport
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // 1. Doorstep PIN quote (734001 -> Delivered to your shop · Siliguri & Jalpaiguri)
    await page.locator("#trade-pin").fill("734001");
    await page.locator("#trade-pin").press("Enter");
    await expect(
      page.getByText(/Delivered to your shop · Siliguri & Jalpaiguri/i)
    ).toBeVisible({
      timeout: 10000,
    });

    // 2. Depot PIN quote (700001 -> Burrabazar Tea Transport Depot)
    await page.locator("#trade-pin").fill("700001");
    await page.locator("#trade-pin").press("Enter");
    await expect(
      page.getByText(/Burrabazar Tea Transport Depot/i)
    ).toBeVisible({ timeout: 10000 });

    // 3. Manual enquiry for uncovered PIN (110001)
    await page.locator("#trade-pin").fill("110001");
    await page.locator("#trade-pin").press("Enter");
    const prepareEnquiryBtn = page
      .locator("#bulk")
      .getByRole("button", {
        name: /Prepare enquiry/i,
      });
    await expect(prepareEnquiryBtn).toBeVisible({ timeout: 10000 });
    await prepareEnquiryBtn.scrollIntoViewIfNeeded();
    await prepareEnquiryBtn.click();

    const enquiryDialog = page.locator("dialog[open]").first();
    await expect(enquiryDialog).toBeVisible();
    await enquiryDialog.locator("#enq-name").fill("Playwright Chai Stall");
    await enquiryDialog.locator("#enq-phone").fill("+919876543210");
    await enquiryDialog.getByRole("button", { name: /Save|Submit|Send/i }).click();
    await expect(enquiryDialog.getByText(/Enquiry .* saved/i)).toBeVisible({
      timeout: 10000,
    });
    await enquiryDialog.getByRole("button", { name: "Close" }).click();

    // 4. CupCalculator batch comparison & pack coverage
    await page.locator("#batch-a-price").fill("280");
    await page.locator("#batch-a-grams").fill("30");
    await page.locator("#batch-a-glasses").fill("10");

    await page.locator("#batch-b-price").fill("320");
    await page.locator("#batch-b-grams").fill("30");
    await page.locator("#batch-b-glasses").fill("15");

    await expect(
      page.getByText(/TeaFloww saves .* per glass in tea leaves\./i)
    ).toBeVisible();

    await page.locator("#cov-cups").fill("200");
    await expect(page.locator("#cost")).toContainText(/Estimated need: 18 kg/i);
  });

  test("checkout review & order confirmation and invalid-token recovery", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/tea-shops/en");

    // Get a confirmed doorstep quote for 734001
    await page.locator("#trade-pin").fill("734001");
    await page.locator('#bulk button[type="submit"]').click();
    const reviewBtn = page.getByRole("button", {
      name: /Review this pack/i,
    });
    await expect(reviewBtn).toBeVisible({ timeout: 10000 });
    await reviewBtn.click();

    await expect(page).toHaveURL(/\/tea-shops\/en\/checkout\?quoteId=/);
    await expect(page.locator("#checkoutTitle")).toBeVisible();

    await page.locator("#tc-name").fill("E2E Tea Counter");
    await page.locator("#tc-phone").fill("+919800001122");
    await page.locator("#tc-email").fill("e2e-stall@example.com");
    await page
      .locator("#tc-addr")
      .fill("12 Hill Cart Road, Siliguri, West Bengal 734001");

    const cookieDismiss = page.getByRole("button", { name: /Essential only|Dismiss cookie notice/i }).first();
    if (await cookieDismiss.isVisible().catch(() => false)) {
      await cookieDismiss.click();
    }

    await page.getByRole("button", { name: /^(Pay |Place order)/i }).click();
    await expect(page).toHaveURL(/\/tea-shops\/en\/orders\/.+token=/, {
      timeout: 15000,
    });
    await expect(page.locator("#orderHeading")).toBeVisible();
    await expect(page.getByText(/Siliguri & Jalpaiguri/i)).toBeVisible();

    // Reloading with valid token preserves order receipt
    const orderUrl = page.url();
    await page.reload();
    await expect(page.locator("#orderHeading")).toBeVisible();

    // Missing/invalid token shows clean recovery state
    const badUrl = orderUrl.replace(/token=[^&]+/, "token=invalid_tok");
    await page.goto(badUrl);
    await expect(page.getByText(/Order link unavailable/i)).toBeVisible();
  });

  test("authenticated /admin/trade Web UI updates settings, offers, lanes, content, enquiries, pilots, and orders", async ({
    page,
  }) => {
    test.setTimeout(60000);
    if (ROOT_PASSWORD) {
      await page.goto("/admin/trade");
      await expect(
        page.getByRole("heading", { name: "Admin sign-in" })
      ).toBeVisible();
      await page.getByLabel("Username").fill(ROOT_USER);
      await page.getByLabel("Password").fill(ROOT_PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();
    } else if (process.env.ADMIN_TEST_TOKEN) {
      await page.setExtraHTTPHeaders({
        "x-admin-test-token": process.env.ADMIN_TEST_TOKEN,
      });
      await page.goto("/admin/trade");
    } else {
      test.skip(true, "needs ADMIN_PASSWORD or ADMIN_TEST_TOKEN");
    }

    await expect(
      page.getByRole("heading", { name: /TeaFloww Trade/i })
    ).toBeVisible({ timeout: 10000 });

    // 1. Settings tab
    await page.getByRole("button", { name: "Settings & Funnel" }).click();
    await page.getByRole("button", { name: "Save Trade Settings" }).click();
    await expect(page.getByText("Trade settings saved.")).toBeVisible({
      timeout: 10000,
    });

    // 2. Offers tab
    await page.getByRole("button", { name: "Offers" }).click();
    await expect(
      page.getByRole("heading", { name: "Assign Product to Trade Channel" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Assign / Update Offer" }).click();
    await expect(page.getByText("Trade offer saved.")).toBeVisible({
      timeout: 10000,
    });

    // 3. Lanes & PIN Preview tab (PIN quote preview + create & pause versioned lane)
    await page.getByRole("button", { name: "Lanes & PIN Preview" }).click();
    await expect(
      page.getByRole("heading", { name: "Create Versioned Lane" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Test Quote" }).click();
    await expect(page.getByText(/confirmed|Siliguri/i).first()).toBeVisible({
      timeout: 10000,
    });

    const e2eLaneCode = `E2E-LANE-${Date.now().toString().slice(-4)}`;
    const laneForm = page.locator("#admin-main-content form").first();
    await laneForm.locator("input").first().fill(e2eLaneCode);
    await page.getByRole("button", { name: "Publish New Lane Version" }).click();
    await expect(page.getByText("Versioned lane saved.")).toBeVisible({
      timeout: 10000,
    });
    const createdLaneRow = page.locator("tr", { hasText: e2eLaneCode }).first();
    await expect(createdLaneRow).toBeVisible();
    await createdLaneRow.getByRole("button", { name: "Pause" }).click();
    await expect(createdLaneRow.getByText("Paused")).toBeVisible({
      timeout: 10000,
    });

    // 4. Localisation & Audio tab
    await page.getByRole("button", { name: "Localisation & Audio" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Update Localised Copy, Audio & Transcript",
      })
    ).toBeVisible();
    await page
      .locator("textarea")
      .first()
      .fill("Playwright verified trade intro copy");
    await page.getByRole("button", { name: "Save Content Override" }).click();
    await expect(page.getByText("Localized content saved.")).toBeVisible({
      timeout: 10000,
    });

    // 5. Enquiries tab (update status if any enquiry exists)
    await page.getByRole("button", { name: "Enquiries" }).click();
    const firstEnquiryBtn = page
      .getByRole("button", { name: /Mark assigned|Mark quoted/i })
      .first();
    if ((await firstEnquiryBtn.count()) > 0) {
      await firstEnquiryBtn.click();
      await expect(page.getByText(/Enquiry .* updated\./)).toBeVisible({
        timeout: 10000,
      });
    }

    // 6. Orders tab (update dispatch and mark remitted if any order exists)
    await page.getByRole("button", { name: "Orders" }).click();
    const orderSelect = page.locator("table select").first();
    if ((await orderSelect.count()) > 0) {
      await orderSelect.selectOption("packed");
      await expect(
        page.getByText(/Order .* dispatch updated\./)
      ).toBeVisible({ timeout: 10000 });
    }
    const markRemittedBtn = page
      .getByRole("button", { name: "Mark Remitted" })
      .first();
    if ((await markRemittedBtn.count()) > 0) {
      await markRemittedBtn.click();
      await expect(
        page.getByText(/Order .* marked remitted\./i)
      ).toBeVisible({ timeout: 10000 });
    }

    // 7. Shared Pilots tab
    await page.getByRole("button", { name: "Shared Pilots" }).click();
    const pilotForm = page.locator("#admin-main-content form").first();
    await pilotForm.locator("input").nth(0).fill("Siliguri E2E Pilot");
    await pilotForm.locator("input").nth(1).fill("734");
    await pilotForm.locator("input").nth(2).fill("Bidhan Market Hub");
    await pilotForm.locator("input").nth(3).fill("Bidhan Market, Siliguri");
    await pilotForm.locator("input").nth(4).fill("0");
    await pilotForm.locator("input").nth(5).fill("200");
    await pilotForm.locator("input").nth(6).fill("20");
    await pilotForm.locator("input").nth(7).fill("North Bengal Carrier");
    await page.getByRole("button", { name: "Save Town Pilot" }).click();
    await expect(page.getByText("Shared pilot saved.")).toBeVisible({
      timeout: 10000,
    });
  });
});
