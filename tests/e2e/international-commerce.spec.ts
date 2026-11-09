import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { marketSchema } from "../../src/lib/international/models";

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`country selector and checkout accessibility at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize(viewport);
    await page.route("https://**", r => r.abort());
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    const trigger = page.getByRole("button", { name: /^Deliver to IN/ }).first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Deliver to" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Country", exact: true })).toHaveValue("IN");
    await dialog.getByRole("searchbox").fill("no-such-destination");
    await expect(dialog.getByRole("combobox", { name: "Country", exact: true })).toHaveValue("IN");
    mkdirSync("output/playwright", { recursive: true });
    await page.screenshot({ path: `output/playwright/international-selector-${viewport.width}.png`, animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("button", { name: "Calculate delivery and total" })).toBeDisabled();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `output/playwright/international-checkout-${viewport.width}.png`, fullPage: true, animations: "disabled" });
  });

  test(`market readiness prevents unsuccessful enable at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize(viewport);
    await page.route("https://**", r => r.abort());
    await page.route("**/api/admin/me", r => r.fulfill({ json: { user: { id: 999, username: "fixture-admin", role: "admin" } } }));
    const m = { ...marketSchema.parse({ code: "IN", name: "India" }), version: 1, reasons: ["Shipping credentials missing"] };
    await page.route("**/api/admin/international/markets", r => r.fulfill({ json: { markets: [m], package: null, campaigns: [], fx: null, status: { shipping: false, razorpay: false } } }));
    await page.route("**/api/admin/international/market", r => {
      expect(r.request().postDataJSON().enabled).toBe(true);
      return r.fulfill({ status: 409, json: { error: "Complete the market readiness checks before enabling checkout." } });
    });
    await page.goto("/admin/markets", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Markets & delivery" })).toBeVisible();
    await page.getByRole("button", { name: "Configure", exact: true }).click();
    await page.getByLabel("Checkout enabled").check();
    await page.getByRole("button", { name: "Save destination", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Complete the market readiness" })).toBeVisible();
    await expect(page.getByRole("cell", { name: /Disabled or not ready/ })).toBeVisible();
    await page.screenshot({ path: `output/playwright/international-admin-markets-${viewport.width}.png`, fullPage: true, animations: "disabled" });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test(`translation draft review and publication at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize(viewport);
    await page.route("https://**", r => r.abort());
    await page.route("**/api/admin/me", r => r.fulfill({ json: { user: { id: 999, username: "fixture-admin", role: "admin" } } }));
    let generated = false, published = false;
    const id = "11111111-1111-4111-8111-111111111111";
    await page.route("**/api/admin/international/translations?**", r => r.fulfill({ json: { resources: [{ resource: "product:1", title: "Fixture tea", source: { name: "Fixture tea" }, status: published ? "published" : generated ? "draft" : "missing", error: null, translation: generated ? { id, draft: JSON.stringify({ name: "चाय" }), published: null } : null }], counts: {} } }));
    await page.route("**/api/admin/international/translate", r => { expect(r.request().postDataJSON()).toEqual({ resources: ["product:1"], locale: "hi" }); generated = true; return r.fulfill({ json: { queued: 1 } }); });
    await page.route("**/api/admin/international/translation", r => { expect(r.request().postDataJSON()).toEqual({ id, action: "publish", texts: { name: "संपादित चाय" } }); published = true; return r.fulfill({ json: { ok: true } }); });
    await page.goto("/admin/translations", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Translate", exact: true }).click();
    await page.getByRole("button", { name: "Review & edit" }).click();
    const editor = page.locator("textarea");
    await expect(editor).toHaveValue("चाय");
    await editor.fill("संपादित चाय");
    await page.getByRole("button", { name: "Publish reviewed translation" }).click();
    await expect(page.getByText("published: 1", { exact: true })).toBeVisible();
    await page.screenshot({ path: `output/playwright/international-admin-translations-${viewport.width}.png`, fullPage: true, animations: "disabled" });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
