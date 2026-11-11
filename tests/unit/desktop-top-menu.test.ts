import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StorefrontHeader, DEFAULT_NAV, DEFAULT_BRAND } from "../../src/components/StorefrontHeader";
import { CartProvider } from "../../src/components/CartProvider";
import { WholesaleProvider } from "../../src/components/wholesale/WholesaleContext";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: vi.fn() }),
}));

function renderHeader(props: React.ComponentProps<typeof StorefrontHeader> = {}) {
  return renderToStaticMarkup(
    React.createElement(
      CartProvider,
      null,
      React.createElement(
        WholesaleProvider,
        null,
        React.createElement(StorefrontHeader, props)
      )
    )
  );
}

describe("Desktop Top Menu UI/UX Pro Max Architecture", () => {
  it("renders brand emblem, name and tagline cleanly", () => {
    mockPathname.mockReturnValue("/");
    const markup = renderHeader();

    expect(markup).toContain(DEFAULT_BRAND);
    expect(markup).toContain("ritual-brand");
    expect(markup).toContain("ritual-brand-name");
    expect(markup).toContain("ritual-brand-emblem");
  });

  it("renders single-line desktop navigation links without wrapping", () => {
    mockPathname.mockReturnValue("/");
    const markup = renderHeader();

    DEFAULT_NAV.forEach((item) => {
      const expectedLabel = item.label.replace("&", "&amp;");
      expect(markup).toContain(expectedLabel);
      expect(markup).toContain(item.href);
    });
    expect(markup).toContain("ritual-nav-link");
    expect(markup).not.toContain("/collections/black-tea");
    expect(markup).not.toContain("/tea-finder");
  });

  it("highlights active route with aria-current='page' and .is-active class", () => {
    mockPathname.mockReturnValue("/shop");
    const markup = renderHeader();

    expect(markup).toContain('href="/shop"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("is-active");
  });

  it("renders compact luxury wholesale trigger button and actions suite", () => {
    mockPathname.mockReturnValue("/");
    const markup = renderHeader();

    expect(markup).toContain("wholesale-header-btn");
    expect(markup).toContain("Wholesale &amp; Bulk");
    expect(markup).toContain('aria-label="Wholesale &amp; Bulk — Open purchase inquiry"');
    expect(markup).toContain('<span class="sr-only"> homepage</span>');
    expect(markup).toContain("tf-search-btn");
    expect(markup).toContain("data-testid=\"cart-count\"");
  });

  it("renders neutral announcement and destination controls without an invented delivery offer", () => {
    mockPathname.mockReturnValue("/");
    const markup = renderHeader({ showAnnouncement: true });

    expect(markup).toContain("Discover your next tea ritual");
    expect(markup).not.toContain("FREE SHIPPING ON ORDERS ABOVE ₹999");
    expect(markup).toContain("tf-announcement-divider");
    expect(markup).toContain("tf-announcement-link");
    expect(markup).toContain("India (INR ₹)");
  });

  it("allows suppressing announcement strip when configured", () => {
    mockPathname.mockReturnValue("/");
    const markup = renderHeader({ showAnnouncement: false });

    expect(markup).not.toContain("FREE SHIPPING ON ORDERS ABOVE ₹999");
    expect(markup).toContain("ritual-header");
  });
});
