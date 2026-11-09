import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

test.describe("Shop Redesign E2E Experience", () => {
  test.beforeAll(() => {
    mkdirSync("docs/ui/screenshots", { recursive: true });
  });

  test("browses shop catalogue, switches view modes, and takes screenshots", async ({
    page,
  }) => {
    test.setTimeout(90000);

    // 1. Visit /shop
    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: /single-estate flushes/i })).toBeVisible();
    await expect(page.getByText(/Darjeeling (First Flush|Spring Clonal)/i).first()).toBeVisible();

    // Capture desktop catalogue screenshot
    await page.screenshot({
      path: "docs/ui/screenshots/shop-desktop.png",
      fullPage: true,
    });

    // 2. Test Category Pill filtering
    const greenPill = page.getByRole("button", { name: /^Green/ });
    if (await greenPill.isVisible()) {
      await greenPill.click();
      await expect(page.getByText(/Nilgiri (Frost|Mist Green)|Kangra/i).first()).toBeVisible();
    }

    // Reset to All Teas
    const allPill = page.getByRole("button", { name: /^All Teas/ });
    await allPill.click();
    await expect(page.getByText(/Darjeeling (First Flush|Spring Clonal)/i).first()).toBeVisible();

    // 3. Test Search filtering
    const searchInput = page.getByPlaceholder(/search by garden/i);
    await searchInput.fill("Assam");
    await expect(page.getByText("Assam Golden Breakfast").first()).toBeVisible();
    await searchInput.clear();

    // 4. Test View Mode toggle to Connoisseur Dossier View
    const dossierBtn = page.getByTitle(/tasting table dossier view/i);
    await dossierBtn.click();
    await expect(page.getByRole("region", { name: /tea cupping dossier comparison/i })).toBeVisible();
    await expect(page.getByText("Cupping Intensity").first()).toBeVisible();

    // Capture table view screenshot
    await page.screenshot({
      path: "docs/ui/screenshots/shop-dossier-desktop.png",
      fullPage: false,
    });

    // Switch back to Grid View
    const gridBtn = page.getByTitle(/grid card view/i);
    await gridBtn.click();
    await expect(page.locator(".shop-product-grid")).toBeVisible();

    // 5. Test Quick View Cupping Sheet Modal
    const quickViewBtn = page.locator(".shop-card-quickview-btn").first();
    await quickViewBtn.click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("Sensory Cupping Radar")).toBeVisible();
    await page.screenshot({
      path: "docs/ui/screenshots/shop-quickview-modal.png",
    });

    // Close modal via Escape
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();

    // 6. Test Mobile Viewport and Drawer
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText(/Darjeeling (First Flush|Spring Clonal)/i).first()).toBeVisible();

    // Open mobile filter drawer
    const filterBtn = page.getByRole("button", { name: /filters/i });
    await filterBtn.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Filter Fine Teas")).toBeVisible();

    await page.screenshot({
      path: "docs/ui/screenshots/shop-mobile-drawer.png",
    });

    // Close drawer via close button
    const closeBtn = page.getByLabel("Close filters");
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();

    // Capture mobile full page screenshot
    await page.screenshot({
      path: "docs/ui/screenshots/shop-mobile.png",
      fullPage: true,
    });
  });
});
