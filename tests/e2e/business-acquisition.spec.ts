import { expect, test } from "@playwright/test";

const ROUTES = [
  { path: "/start-tea-business", heading: /tea business starts with a better first step/i },
  { path: "/tea-traders", heading: /source tea/i },
];

for (const route of ROUTES) {
  test(`${route.path} renders cleanly on narrow mobile (360px) with no horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(route.path);

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(route.heading);
    await expect(page.getByRole("link", { name: /quote|plan/i }).first()).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(overflow).toBe(false);
  });
}

test("switches between English and Hindi without blocking modal", async ({ page }) => {
  await page.goto("/start-tea-business");
  await page.getByRole("link", { name: "हिन्दी" }).click();
  await expect(page).toHaveURL(/lang=hi/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("चाय का बिज़नेस");
});

test("rejects invalid mobile number with accessible inline error", async ({ page }) => {
  await page.goto("/start-tea-business");
  await page.getByLabel(/Delivery pincode/i).fill("734001");
  await page.getByLabel(/Your name/i).fill("Sample Buyer");
  await page.getByLabel(/Mobile number/i).fill("12345");
  await page.getByLabel(/I agree TeaFloww may contact/i).check();
  await page.getByRole("button", { name: /Request My Quote/i }).click();

  await expect(page.getByText(/valid 10-digit Indian mobile number/i).first()).toBeVisible();
});

test("submits a valid starter lead and displays opaque reference", async ({ page }) => {
  await page.goto("/start-tea-business");
  await page.getByLabel(/Delivery pincode/i).fill("734001");
  await page.getByLabel(/Your name/i).fill("Rohan Das");
  await page.getByLabel(/Mobile number/i).fill("9876543210");
  await page.getByLabel(/I agree TeaFloww may contact/i).check();
  await page.getByRole("button", { name: /Request My Quote/i }).click();

  await expect(page.getByRole("heading", { name: /Enquiry received/i })).toBeVisible();
  await expect(page.getByText(/TFB-/)).toBeVisible();
});
