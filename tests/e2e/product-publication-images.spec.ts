import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

// Test gallery behavior with real local fixture bytes, independently of the optimizer.
async function serveFixtureImages(page: Page) {
  const files = ["/images/product-darjeeling-tin.jpg", "/uploads/upload_1791922620547_bc1fa9a14412_arya_ruby_leaf.webp"];
  await page.route("**/_next/image?**", async (route) => {
    const file = new URL(route.request().url()).searchParams.get("url");
    if (file && files.includes(file)) return route.fulfill({ path: path.join(process.cwd(), "public", file.slice(1)) });
    return route.continue();
  });
}

for (const width of [1440, 390]) {
  test(`publish and assign multiple variants at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    await page.route("https://**", (route) => route.abort());
    await serveFixtureImages(page);
    const variants = [
      { id: 99011, sku: "BROWSER-50", grams: 50, packaging_format: "loose_leaf_pouch", stock: 5, price_paise: 19900, servings: 25 },
      { id: 99012, sku: "BROWSER-100", grams: 100, packaging_format: "loose_leaf_pouch", stock: 5, price_paise: 29900, servings: 50 },
    ];
    let status = "draft";
    let images = [{ id: 99021, url: "/images/product-darjeeling-tin.jpg", alt_text: "Test image", sort_order: 0, is_primary: 1, variant_skus: ["BROWSER-50"] }];
    let fail = true;
    const product = () => ({ id: 99001, slug: "variant-image-browser", name: "Variant Image Browser Tea", category: "Black Tea", origin: "Test origin", estate: "Test estate", description: "Test description", ingredients: "", flush: "Test flush", status, is_enabled: 1, variants, images, brew_temp: 90, brew_seconds: 180, floral: 0, fruity: 0, malty: 0, body: 0 });
    await page.route("**/api/admin/me", (route) => route.fulfill({ json: { user: { username: "test-admin", role: "admin" } } }));
    await page.route("**/api/admin/products/99001", (route) => route.fulfill({ json: { product: product() } }));
    await page.route("**/api/admin/products/99001/publication", (route) => {
      status = route.request().postDataJSON().status;
      return route.fulfill({ json: { id: 99001, status, is_enabled: 1 } });
    });
    await page.route("**/api/admin/products/99001/images", (route) => {
      if (fail) return route.fulfill({ status: 500, json: { error: "Save failed" } });
      images = route.request().postDataJSON().images;
      return route.fulfill({ json: { images } });
    });
    await page.goto("/admin/products/99001", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Make live: Variant Image Browser Tea", exact: true }).click();
    await expect(page.getByRole("button", { name: "Move to draft: Variant Image Browser Tea", exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "is now live" })).toBeVisible();
    const first = page.getByRole("checkbox", { name: "Image 1: BROWSER-50", exact: true });
    const second = page.getByRole("checkbox", { name: "Image 1: BROWSER-100", exact: true });
    await expect(first).toBeChecked();
    await second.check();
    await page.getByRole("button", { name: "Save images", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Unable to save images" })).toBeVisible();
    await expect(second).toBeChecked();
    fail = false;
    await page.getByRole("button", { name: "Save images", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "variant assignments saved" })).toBeVisible();
    expect(images[0].variant_skus).toEqual(["BROWSER-50", "BROWSER-100"]);
    const editor = page.getByRole("region", { name: "Manage product images", exact: true });
    await editor.getByLabel("Image URL", { exact: true }).fill("/images/product-darjeeling-tin.jpg");
    await editor.getByLabel("Image description", { exact: true }).fill("New uploaded view");
    await editor.getByRole("button", { name: "Add URL", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Image 2: BROWSER-50", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Image 2: BROWSER-100", exact: true })).not.toBeChecked();
    mkdirSync("docs/ui/screenshots", { recursive: true });
    await editor.locator("img").first().scrollIntoViewIfNeeded();
    await expect.poll(() => editor.locator("img").first().evaluate((image) => (image as HTMLImageElement).naturalWidth), { timeout: 15000 }).toBeGreaterThan(0);
    await page.screenshot({ path: `docs/ui/screenshots/product-image-assignment-${width}.png`, fullPage: true, animations: "disabled" });
  });
  test(`storefront images follow the selected pack at ${width}px`, async ({ page }) => {
    test.skip(!process.env.PRODUCT_IMAGE_FIXTURE, "Needs the isolated variant-image-browser product fixture.");
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    await page.route("https://**", (route) => route.abort());
    await serveFixtureImages(page);
    await page.goto("/tea/variant-image-browser", { waitUntil: "domcontentloaded" });
    const gallery = page.getByTestId("product-gallery");
    await expect(gallery.locator(".gallery-main img")).toHaveAttribute("alt", "50g pack");
    const sizes = page.getByTestId("variant-size-option");
    await expect(sizes.filter({ hasText: "50g" })).toHaveAttribute("aria-pressed", "true");
    await sizes.filter({ hasText: "100g" }).click();
    await expect(gallery.locator(".gallery-main img")).toHaveAttribute("alt", "100g pack");
    await expect.poll(() => gallery.locator(".gallery-main img").evaluate((image) => (image as HTMLImageElement).naturalWidth), { timeout: 15000 }).toBeGreaterThan(0);
    await expect(gallery.getByRole("button", { name: /50g pack/ })).toHaveCount(0);
    await expect(gallery.getByRole("button", { name: /Shared leaf/ })).toBeVisible();
    await gallery.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `docs/ui/screenshots/product-variant-gallery-${width}.png`, fullPage: true, animations: "disabled" });
    await sizes.filter({ hasText: "50g" }).click();
    await expect(gallery.locator(".gallery-main img")).toHaveAttribute("alt", "50g pack");
  });
}
