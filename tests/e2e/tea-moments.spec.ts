import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

// Run against an isolated local SQLite preview with a short-lived fixture session.
const fixtureFile = process.env.TEA_MOMENTS_FIXTURE;
const fixture = fixtureFile ? JSON.parse(readFileSync(fixtureFile, "utf8")) : null;
test.skip(!fixture, "Set TEA_MOMENTS_FIXTURE to the isolated preview fixture JSON.");
test.describe.configure({ mode: "serial" });
const artifactDir = "docs/ui/tea-moments";

for (const width of [1440, 768, 390, 320]) {
  test(`Tea Moments layout and navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/tea/${fixture.slug}`);
    if (width >= 768) {
      const tab = page.getByRole("tab", { name: "Tea Moments", exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await tab.press("Home");
      await expect(page.getByRole("tab", { name: "All Overview" })).toBeFocused();
      await tab.focus(); await tab.press("Enter");
    } else {
      const trigger = page.getByRole("button", { name: "Tea Moments", exact: true });
      await trigger.scrollIntoViewIfNeeded(); await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await trigger.press("Enter"); await expect(trigger).toHaveAttribute("aria-expanded", "true");
    }
    const section = page.getByTestId("tea-moments").filter({ visible: true });
    await expect(section.getByRole("heading", { name: "Make it your moment." })).toBeVisible();
    await expect(section.locator("img")).toBeVisible();
    await expect.poll(() => section.locator("img").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByText("Catalogue provenance", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await section.scrollIntoViewIfNeeded();
    mkdirSync(artifactDir, { recursive: true });
    await section.screenshot({ path: `${artifactDir}/moments-${width}.png`, animations: "disabled", style: ".sticky-purchase-bar, header, nextjs-portal { visibility: hidden !important; }" });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${artifactDir}/product-${width}.png`, fullPage: true, animations: "disabled", style: "nextjs-portal { display: none !important; }" });
  });
}

test("admin edits, validation, clearing, and missing images", async ({ page, context }) => {
  await context.addCookies([{ name: "admin_session", value: fixture.cookie, url: test.info().project.use.baseURL as string }]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/admin/products/${fixture.id}/edit`);
  const editor = page.getByRole("region", { name: "Tea Moments", exact: true });
  await expect(editor.getByRole("textbox", { name: "Introduction", exact: true })).toHaveValue(fixture.content.introduction);
  for (const label of ["Origin / Region", "Tea Estate", "Flush / Harvest Season", "Harvest Date", "Elevation", "Lot Number", "Verified Origin & Provenance"]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
  }
  await editor.scrollIntoViewIfNeeded(); await editor.screenshot({ path: `${artifactDir}/admin-1440.png`, animations: "disabled", style: "nextjs-portal { display: none !important; }" });
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(await editor.evaluate((element) => element.getBoundingClientRect().right <= innerWidth)).toBe(true);
  await editor.screenshot({ path: `${artifactDir}/admin-390.png`, animations: "disabled", style: "nextjs-portal { display: none !important; }" });
  await editor.getByRole("textbox", { name: "Introduction", exact: true }).fill("Browser test: a moment for your cup.");
  const save = page.getByRole("button", { name: /save|update product|create product/i }).first();
  const response = page.waitForResponse((r) => r.url().endsWith(`/api/admin/products/${fixture.id}`) && r.request().method() === "PATCH");
  await save.click(); expect((await response).ok()).toBe(true);
  await page.goto(`/tea/${fixture.slug}`);
  await expect(page.getByText("Browser test: a moment for your cup.", { exact: true }).filter({ visible: true })).toBeVisible();
  const patch = async (body: unknown) => context.request.patch(`/api/admin/products/${fixture.id}`, { data: body });
  expect((await patch({ tea_moments: { ...fixture.content, image_url: "/uploads/nonexistent-tea-moments-test.webp" } })).ok()).toBe(true);
  await page.reload();
  await page.getByTestId("tea-moments").filter({ visible: true }).scrollIntoViewIfNeeded();
  await expect(page.getByTestId("tea-moments").filter({ visible: true }).locator("figure")).toHaveCount(0);
  expect((await patch({ tea_moments: { ...fixture.content, image_url: "javascript:alert(1)" } })).status()).toBe(400);
  expect((await patch({ tea_moments: null })).ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Tea Moments", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("tea-moments")).toHaveCount(0);
  await patch({ tea_moments: fixture.content });
});
