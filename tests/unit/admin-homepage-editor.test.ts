import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { homepageSchema } from "../../src/lib/homepageSchema";
import { LiveHomepagePreview } from "../../src/components/admin/content/homepage/LiveHomepagePreview";
import seed from "../../scripts/content/homepage.json";
import additions from "../../scripts/content/homepage-completion.json";

describe("Homepage Visual Director & Live Storefront Preview", () => {
  const completeMockContent = homepageSchema.parse({
    ...seed,
    ...additions,
  });

  const mockCategories = [
    { id: 1, name: "Black Tea" },
    { id: 2, name: "Green Tea" },
    { id: 3, name: "White Tea" },
    { id: 4, name: "Oolong" },
  ];

  it("validates that mock seed conforms to homepageSchema", () => {
    expect(completeMockContent.brand).toBe("TEAFLOWW");
    expect(completeMockContent.hero.title).toBe("Closer to the garden.");
    expect(completeMockContent.hero.primary.href).toBe("/shop");
    expect(completeMockContent.discovery.tiles).toHaveLength(2);
    expect(completeMockContent.benefits).toHaveLength(4);
    expect(completeMockContent.story?.caption).toContain("More than tea.");
  });

  it("renders LiveHomepagePreview mockup in Desktop mode without throwing", () => {
    const markup = renderToStaticMarkup(
      React.createElement(LiveHomepagePreview, {
        content: completeMockContent,
        categories: mockCategories,
      })
    );

    // Verify key sections and content rendered
    expect(markup).toContain("Live Storefront Simulation");
    expect(markup).toContain("TEAFLOWW");
    expect(markup).toContain("Closer to the garden.");
    expect(markup).toContain("Better in the cup.");
    expect(markup).toContain("How do you like");
    expect(markup).toContain("THE CURATED SHELF");
    expect(markup).toContain("Leaves worth");
    expect(markup).toContain("OUR PHILOSOPHY");
    expect(markup).toContain("A little curious?");
    expect(markup).toContain("Explore the leaves");
    expect(markup).toContain("JOIN OUR TEA CIRCLE");
    expect(markup).toContain("Demo collection");
  });

  it("renders genuine reviews when approved and isolates draft testimonials by default", () => {
    const contentWithReviews = homepageSchema.parse({
      ...completeMockContent,
      reviews: {
        eyebrow: "THE TEA CIRCLE",
        title: "Good tea.",
        emphasis: "Your stories next.",
        empty_title: "A new chapter, shared over tea.",
        empty_description: "Community stories will appear here.",
        cta: { label: "Find your tea", href: "/tea-finder" },
        entries: [
          {
            quote: "An extraordinary spring harvest with floral notes.",
            attribution: "Sunil K., Verified Connoisseur",
            approved: true,
          },
          {
            quote: "Unverified draft quote that must remain hidden.",
            attribution: "Anonymous Draft",
            approved: false,
          },
        ],
      },
    });

    const markup = renderToStaticMarkup(
      React.createElement(LiveHomepagePreview, {
        content: contentWithReviews,
        categories: mockCategories,
      })
    );

    // Approved review must be displayed
    expect(markup).toContain("An extraordinary spring harvest with floral notes.");
    expect(markup).toContain("Sunil K., Verified Connoisseur");

    // Draft unverified review must NOT be displayed on the public mockup
    expect(markup).not.toContain("Unverified draft quote that must remain hidden.");
  });

  it("rejects untrusted external protocol links in link schema", () => {
    const maliciousTest = {
      ...completeMockContent,
      hero: {
        ...completeMockContent.hero,
        primary: {
          label: "Attack",
          href: "javascript:alert(document.cookie)",
        },
      },
    };

    const parsed = homepageSchema.safeParse(maliciousTest);
    expect(parsed.success).toBe(false);
  });

  it("accepts valid local paths beginning with /", () => {
    const validTest = {
      ...completeMockContent,
      hero: {
        ...completeMockContent.hero,
        primary: {
          label: "Explore",
          href: "/shop?category=First%20Flush",
        },
      },
    };

    const parsed = homepageSchema.safeParse(validTest);
    expect(parsed.success).toBe(true);
  });
});
