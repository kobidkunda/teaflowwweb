import { test, expect } from "@playwright/test";

// t3 verification: admin sign-in is keyboard- and screen-reader-usable on
// desktop and mobile viewports. The valid-login round-trip only runs when the
// dev server has a root password available (ADMIN_PASSWORD from the dev .env);
// it touches only the sessions table and signs out again afterwards.
const ROOT_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ROOT_USER = process.env.ADMIN_USERNAME || "root";

test.describe("admin sign-in (a11y, desktop + mobile)", () => {
  test("unauthenticated console shows a labelled sign-in form", async ({ page }) => {
    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
    const form = page.getByRole("form", { name: "Admin sign-in" });
    await expect(form).toBeVisible();
    await expect(form.getByLabel("Username")).toBeVisible();
    await expect(form.getByLabel("Password")).toBeVisible();
    await expect(form.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("keyboard-only path: tab to fields, enter submits, error lands in an alert", async ({
    page,
  }) => {
    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
    // Tab from the top reaches the username field without a mouse.
    await page.keyboard.press("Tab");
    for (let i = 0; i < 30; i++) {
      const tag = await page.evaluate(() => document.activeElement?.tagName);
      const name = await page.evaluate(
        () => (document.activeElement as HTMLInputElement)?.name
      );
      if (tag === "INPUT" && name === "username") break;
      await page.keyboard.press("Tab");
    }
    await expect(page.locator('input[name="username"]')).toBeFocused();
    await page.keyboard.type("root");
    await page.keyboard.press("Tab");
    await expect(page.locator('input[name="password"]')).toBeFocused();
    await page.keyboard.type("wrong-password-123");
    await page.keyboard.press("Enter");
    await expect(page.locator("main").getByRole("alert")).toContainText("Invalid username or password.");
  });

  test("wrong password surfaces a generic alert (no oracle, no stack)", async ({ page }) => {
    await page.goto("/admin/products");
    await page.getByLabel("Username").fill("root");
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    const alert = page.locator("main").getByRole("alert");
    await expect(alert).toHaveText("Invalid username or password.");
    // Visible text only: dev-mode HTML embeds RSC flight data containing the
    // word "stack", so a raw-HTML scan would false-positive. API-level
    // no-leak is covered in unit tests; here we assert what a user can read.
    const visible = await page.locator("main").innerText();
    expect(visible).not.toMatch(/sqlite|stack|constraint|password_hash/i);
  });

  test("mobile viewport keeps the sign-in form usable with no sideways scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.getByLabel("Username").fill("root");
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("Invalid username or password.");
  });

  test("valid login signs in and sign-out returns to the form", async ({ page }) => {
    test.skip(!ROOT_PASSWORD, "needs ADMIN_PASSWORD from the dev .env");
    await page.goto("/admin/products");
    await page.getByLabel("Username").fill(ROOT_USER);
    await page.getByLabel("Password").fill(ROOT_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(`Signed in as ${ROOT_USER}.`)).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByText("Signed out.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
  });
});

test.describe("password reset console", () => {
  test("forgot + reset forms are labelled and prefill the token from the link", async ({
    page,
  }) => {
    await page.goto("/admin/reset?token=abc123token");
    await expect(page.getByRole("form", { name: "Request password reset" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Set new password" })).toBeVisible();
    await expect(page.getByLabel("Account email")).toBeVisible();
    await expect(page.getByLabel("Reset token")).toHaveValue("abc123token");
    // Unknown email still answers success (no oracle), without navigating away.
    await page.getByLabel("Account email").fill("nobody-knows-this@example.com");
    await page.getByRole("button", { name: "Email reset link" }).click();
    await expect(page.getByRole("status")).toContainText("reset link is on its way");
  });
});
