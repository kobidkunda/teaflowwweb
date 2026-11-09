import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`sample kit navigation starts at the top at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#home-trials");
    const invitation = page.getByRole("region", { name: "Find your cup. Start with a sample." });
    const link = invitation.getByRole("link", { name: "Explore all sample kits" });
    await link.scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    await link.click();
    await expect(page).toHaveURL(/\/trials#top$/);
    await expect(page.locator("#trials-title")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/#home-trials$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  });
}
