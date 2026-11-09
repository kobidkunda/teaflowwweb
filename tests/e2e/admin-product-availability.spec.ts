import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`product availability switches and disabled filter at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize(viewport);
    await page.route("https://**", (route) => route.abort());
    let enabled = 1;
    let failSave = false;
    let releaseSave: (() => void) | undefined;
    let holdSave = false;
    const product = () => ({ id: 1, name: "Test Tea", slug: "test-tea", origin: "Test origin", estate: "Test estate", category: "Tea", category_id: 1, status: "draft", featured: 0, floral: 0, fruity: 0, malty: 0, body: 0, is_enabled: enabled, variants: [{ id: 1, sku: "TEST", price_paise: 19900, stock: 5, grams: 100 }] });
    await page.route("**/api/admin/me", (route) => route.fulfill({ json: { user: { username: "test-admin", role: "admin" } } }));
    await page.route("**/api/admin/categories", (route) => route.fulfill({ json: { categories: [{ id: 1, name: "Tea" }] } }));
    await page.route("**/api/admin/products?**", (route) => route.fulfill({ json: { products: [product()], totalPages: 1 } }));
    await page.route("**/api/admin/products/1/availability", async (route) => {
      expect(Object.keys(route.request().postDataJSON())).toEqual(["enabled"]);
      if (holdSave) await new Promise<void>((resolve) => { releaseSave = resolve; });
      if (failSave) return route.fulfill({ status: 500, json: { error: "Unable to save" } });
      enabled = route.request().postDataJSON().enabled ? 1 : 0;
      await route.fulfill({ json: { id: 1, is_enabled: enabled } });
    });
    await page.goto("/admin/products", { waitUntil: "domcontentloaded" });
    const toggle = page.getByRole("switch", { name: "Enable Test Tea", exact: true });
    const filter = page.getByRole("switch", { name: "Disabled products only", exact: true });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(filter).toHaveAttribute("aria-checked", "false");
    mkdirSync("docs/ui/screenshots", { recursive: true });
    await page.screenshot({ path: `docs/ui/screenshots/admin-products-enabled-${viewport.width}.png`, fullPage: true, animations: "disabled" });
    failSave = true;
    await toggle.click();
    await expect(page.getByRole("alert").filter({ hasText: "Unable to disable" })).toContainText("Unable to disable Test Tea");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    failSave = false;
    holdSave = true;
    await toggle.click();
    await expect(toggle).toBeDisabled();
    await expect(toggle).toContainText("Saving");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => Boolean(releaseSave)).toBe(true);
    releaseSave!();
    holdSave = false;
    await expect(toggle).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "No products found" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Test Tea disabled." })).toBeVisible();
    await filter.focus();
    await page.keyboard.press("Space");
    await expect(filter).toHaveAttribute("aria-checked", "true");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("table").getByText("Draft", { exact: true })).toBeVisible();
    // Refresh re-reads the saved disabled state from the catalogue endpoint.
    await filter.click();
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No products found" })).toBeVisible();
    await expect(toggle).toHaveCount(0);
    await filter.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await page.screenshot({ path: `docs/ui/screenshots/admin-products-disabled-${viewport.width}.png`, fullPage: true, animations: "disabled" });
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveCount(0);
    await expect(page.getByText("No disabled products.", { exact: false })).toBeVisible();
    await filter.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("table").getByText("Draft", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}
