import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StorefrontShell } from "../../src/components/StorefrontShell";

// Mock next/navigation usePathname and useRouter
const mockPathname = vi.fn();
const mockRouter = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => mockRouter,
}));

describe("StorefrontShell Component Layout Isolation", () => {
  it("reserves a viewport before homepage content streams, keeping the footer out of first paint", () => {
    mockPathname.mockReturnValue("/");
    const markup = renderToStaticMarkup(
      React.createElement(StorefrontShell, null,
        React.createElement("div", { role: "status" }, "Loading the tea collection…"))
    );
    expect(markup).toContain('id="main-content" tabindex="-1" style="min-height:100svh"');
    expect(markup.indexOf("Loading the tea collection")).toBeLessThan(markup.indexOf("<footer"));
  });

  it("renders storefront Header and Footer on customer routes", () => {
    mockPathname.mockReturnValue("/shop");
    const markup = renderToStaticMarkup(
      React.createElement(StorefrontShell, null, React.createElement("div", { id: "shop-content" }, "Shop Content"))
    );

    // Contains storefront header and navigation links
    expect(markup).toContain("TEAFLOWW");
    expect(markup).toContain("Shop Tea");
    expect(markup).toContain("Leaf to Cup");
    expect(markup).toContain("Blend Lab");
    expect(markup).toContain("Track Order");
    expect(markup).toContain('id="shop-content"');
    // Contains site footer
    expect(markup).toContain('footer tf-footer');
  });

  it("completely suppresses storefront Header and Footer on /admin routes", () => {
    mockPathname.mockReturnValue("/admin");
    const markup = renderToStaticMarkup(
      React.createElement(StorefrontShell, null, React.createElement("div", { id: "admin-box" }, "Admin Sign-in"))
    );

    // Suppresses storefront navigation
    expect(markup).not.toContain("Shop Tea");
    expect(markup).not.toContain("Black Teas");
    expect(markup).not.toContain("Tea Finder");
    expect(markup).not.toContain("Track Order");
    expect(markup).not.toContain('class="footer"');
    expect(markup).not.toContain("announcement");
    expect(markup).toContain('id="admin-box"');
    expect(markup).toContain("Admin Sign-in");
  });

  it("suppresses storefront Header and Footer on nested /admin/products routes", () => {
    mockPathname.mockReturnValue("/admin/products/new");
    const markup = renderToStaticMarkup(
      React.createElement(StorefrontShell, null, React.createElement("div", { id: "new-prod" }, "New Product"))
    );

    expect(markup).not.toContain("Shop Tea");
    expect(markup).not.toContain('class="footer"');
    expect(markup).toContain('id="new-prod"');
  });

  it("includes Blend Lab in default navigation", () => {
    mockPathname.mockReturnValue("/");
    const markup = renderToStaticMarkup(
      React.createElement(StorefrontShell, null, React.createElement("div", null, "Home"))
    );
    expect(markup).toContain("Blend Lab");
    expect(markup).toContain("/blend-lab");
  });

  it("ensures blend-lab page renders with only a single header and footer in StorefrontShell", async () => {
    mockPathname.mockReturnValue("/blend-lab");
    const { default: BlendLabPage } = await import("../../src/app/blend-lab/page");
    const markup = renderToStaticMarkup(
      React.createElement(StorefrontShell, null, React.createElement(BlendLabPage))
    );

    // Count header and footer tags
    const headerMatches = markup.match(/<header\b/g) || [];
    const footerMatches = markup.match(/<footer\b/g) || [];
    expect(headerMatches.length).toBe(1);
    expect(footerMatches.length).toBe(1);
  });
});
