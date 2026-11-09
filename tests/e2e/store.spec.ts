import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("homepage and mobile screenshot", async ({ page }) => {
  mkdirSync("docs/ui/screenshots", { recursive: true });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /(closer to the garden|single-estate flushes)/i }).first()).toBeVisible();
  await page.screenshot({ path: "docs/ui/screenshots/home-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.screenshot({ path: "docs/ui/screenshots/home-mobile.png", fullPage: true });
});
test("shop, PDP and add to bag", async ({ page }) => {
  mkdirSync("docs/ui/screenshots", { recursive: true });
  await page.goto("/shop");
  await expect(page.getByText(/Darjeeling Spring/i).first()).toBeVisible();
  await page.goto("/tea/darjeeling-spring");
  await expect(page.getByRole("heading", { name: /Darjeeling Spring/i }).first()).toBeVisible();
  await page.screenshot({ path: "docs/ui/screenshots/product-desktop.png", fullPage: true });
  await page.getByRole("button", { name: /(add to bag|quick add)/i }).first().click();
  await page.goto("/cart");
  await expect(page.getByText(/Darjeeling Spring/i).first()).toBeVisible();
});
test("tea finder recommends a product", async ({ page }) => {
  await page.goto("/tea-finder");
  await page.getByRole("button", { name: /without milk/i }).click();
  await page.getByRole("button", { name: /bold & malty/i }).click();
  await page.getByRole("button", { name: /bright mornings/i }).click();
  await expect(page.getByText("Assam Golden Breakfast")).toBeVisible();
});
test("health API is available", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
});
