import { expect, test } from "@playwright/test";

test.describe("Homepage — Our Signature Blends Showcase", () => {
  test("displays x-y price range and opens modal on Add to Cart click", async ({ page }) => {
    await page.goto("/");

    // Locate the signature blends section
    const signatureSection = page.locator("#tf-signature-section");
    await expect(signatureSection).toBeVisible();

    // Verify title and eyebrow
    await expect(signatureSection.getByText(/OUR SIGNATURE BLENDS/i)).toBeVisible();

    // Check first product card in the carousel track
    const firstCard = signatureSection.locator(".tf-product-card").first();
    await expect(firstCard).toBeVisible();

    // Verify price range is displayed (e.g., contains "–")
    const priceElement = firstCard.locator(".tf-card-price");
    await expect(priceElement).toBeVisible();
    const priceText = await priceElement.textContent();
    expect(priceText).toBeTruthy();
    expect(priceText).toContain("–"); // Verifies price range separator

    // Click the Add to cart button on the first card
    const addToCartBtn = firstCard.getByRole("button", { name: /Add .* to bag/i });
    await expect(addToCartBtn).toBeEnabled();
    await addToCartBtn.click();

    // Verify the QuickVariantModal opens
    const modalBackdrop = page.locator(".quick-variant-backdrop");
    await expect(modalBackdrop).toBeVisible({ timeout: 10000 });

    // Verify modal content
    const modalCard = modalBackdrop.locator(".quick-variant-modal-card");
    await expect(modalCard).toBeVisible();
    await expect(modalCard.getByText(/Added to Bag/i)).toBeVisible();
    await expect(modalCard.getByRole("radiogroup", { name: /Product Variants/i })).toBeVisible();
    await expect(modalCard.locator("[data-testid='quick-modal-checkout-btn']")).toBeVisible();

    // Close the modal
    const closeBtn = modalCard.locator(".quick-variant-close-btn");
    await closeBtn.click();
    await expect(modalBackdrop).not.toBeVisible();
  });
});
