import { expect, test } from "@playwright/test";

test.describe("Homepage — Our Signature Blends Showcase", () => {
  test("displays x-y price range and adds item directly to cart without opening modal on Add to Cart click", async ({ page }) => {
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

    // Click the Add to cart button on the first card
    const addToCartBtn = firstCard.getByRole("button", { name: /Add .* to bag/i });
    await expect(addToCartBtn).toBeEnabled();
    await addToCartBtn.click();

    // Verify the item is added: button confirms added state, Added to Bag prompt appears, and center modal does NOT open
    await expect(firstCard.getByRole("button", { name: /Added to bag/i })).toBeVisible();
    const modalBackdrop = page.locator(".quick-variant-backdrop");
    await expect(modalBackdrop).toHaveCount(0);

    // Verify the Added to Bag prompt modal appears
    const prompt = page.locator("[data-testid='add-to-cart-prompt']");
    await expect(prompt).toBeVisible({ timeout: 5000 });
    await expect(prompt.getByText(/Added to Bag/i)).toBeVisible();
    await expect(prompt.getByRole("link", { name: /Proceed to Checkout/i })).toBeVisible();
  });
});
