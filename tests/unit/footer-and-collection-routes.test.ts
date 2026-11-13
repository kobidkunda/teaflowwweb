import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Footer } from "@/components/Footer";
import { getSiteNavigation } from "@/lib/contentBlocks";
import CategoryCollectionPage, { generateMetadata } from "@/app/collections/[slug]/page";

describe("Footer Dynamic Links & Blog Navigation", () => {
  it("renders 'Tea Journal & Blog' heading and prominent '/blog' link with Blog badge", () => {
    const markup = renderToStaticMarkup(React.createElement(Footer));
    expect(markup).toContain("Tea Journal &amp; Blog");
    expect(markup).toContain('href="/blog"');
    expect(markup).toContain("Blog");
  });

  it("dynamically renders blog articles when blogs prop is provided", () => {
    const mockBlogs = [
      { slug: "custom-darjeeling-guide", title: "Custom Darjeeling Spring Notes" },
      { slug: "art-of-milk-chai", title: "The Art of Strong Milk Chai" },
    ];
    const markup = renderToStaticMarkup(
      React.createElement(Footer, { blogs: mockBlogs })
    );
    expect(markup).toContain('href="/blog/custom-darjeeling-guide"');
    expect(markup).toContain("Custom Darjeeling Spring Notes");
    expect(markup).toContain('href="/blog/art-of-milk-chai"');
    expect(markup).toContain("The Art of Strong Milk Chai");
  });

  it("dynamically renders active categories in Shop column when categories prop is provided", () => {
    const mockCategories = [
      { id: 101, name: "Specialty Orthodox", slug: "specialty-orthodox" },
      { id: 102, name: "Autumn Flush Lots", slug: "autumn-flush" },
    ];
    const markup = renderToStaticMarkup(
      React.createElement(Footer, { categories: mockCategories })
    );
    expect(markup).toContain('href="/collections/specialty-orthodox"');
    expect(markup).toContain("Specialty Orthodox");
    expect(markup).toContain('href="/collections/autumn-flush"');
    expect(markup).toContain("Autumn Flush Lots");
  });

  it("always provides working links for key collections including Darjeeling First Flush and Reserve Black Teas", () => {
    const markup = renderToStaticMarkup(React.createElement(Footer));
    expect(markup).toContain('href="/collections/darjeeling-first-flush"');
    expect(markup).toContain("Darjeeling First Flush");
    expect(markup).toContain('href="/collections/black-tea"');
    expect(markup).toContain("Reserve Black Teas");
    expect(markup).toContain('href="/collections/green-tea"');
    expect(markup).toContain("Green &amp; White Teas");
  });

  it("prioritizes operator homepage footer_links and preserves them in footer", () => {
    const mockContent = {
      brand: "TEAFLOWW",
      tagline: "Pure Orthodox Teas",
      navigation: [],
      footer_links: [
        { label: "Gondhoraj Lebu Cha", href: "/blog/gondhoraj-lebu-cha-guide" },
        { label: "Nolen Gur Chai Tradition", href: "/blog/nolen-gur-chai-guide" },
      ],
      hero: { eyebrow: "", title: "", emphasis: "", description: "", image_url: "/img.jpg", image_alt: "", primary: { label: "", href: "/" }, secondary: { label: "", href: "/" } },
      discovery: { eyebrow: "", title: "", emphasis: "", description: "", tiles: [] },
      shelf: { eyebrow: "", title: "", emphasis: "", cta: { label: "", href: "/" }, empty_title: "", empty_description: "", fallback_image_url: "/f.jpg", fallback_image_alt: "" },
      trials: { enabled: false, eyebrow: "", title: "", emphasis: "", description: "", badge_text: "", cta: { label: "", href: "/" } },
      reviews: { eyebrow: "", title: "", emphasis: "", entries: [] },
      faq: { eyebrow: "", title: "", emphasis: "", items: [] },
      newsletter: { eyebrow: "", title: "", emphasis: "", description: "", button_label: "", placeholder: "", disclaimer: "" },
    };
    const markup = renderToStaticMarkup(
      React.createElement(Footer, { content: mockContent as any })
    );
    expect(markup).toContain('href="/blog/gondhoraj-lebu-cha-guide"');
    expect(markup).toContain("Gondhoraj Lebu Cha");
    expect(markup).toContain('href="/blog/nolen-gur-chai-guide"');
    expect(markup).toContain("Nolen Gur Chai Tradition");
  });
});

describe("Collection Route Resilience (/collections/[slug])", () => {
  it("resolves /collections/darjeeling-first-flush without 404", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "darjeeling-first-flush" }) });
    expect(meta.title).toContain("Darjeeling First Flush");
    expect(meta.description).toContain("Darjeeling");

    const pageElement = await CategoryCollectionPage({
      params: Promise.resolve({ slug: "darjeeling-first-flush" }),
    });
    const markup = renderToStaticMarkup(pageElement);
    expect(markup).toContain("Darjeeling First Flush");
    expect(markup).toContain("Tea Journal &amp; Brewing Guide");
    expect(markup).toContain("/blog/darjeeling-first-flush-guide");
  });

  it("resolves /collections/black-tea without 404", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "black-tea" }) });
    expect(meta.title).toContain("Black Tea");

    const pageElement = await CategoryCollectionPage({
      params: Promise.resolve({ slug: "black-tea" }),
    });
    const markup = renderToStaticMarkup(pageElement);
    expect(markup).toContain("Black Tea");
  });

  it("resolves /collections/green-tea without 404", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "green-tea" }) });
    expect(meta.title).toContain("Green");

    const pageElement = await CategoryCollectionPage({
      params: Promise.resolve({ slug: "green-tea" }),
    });
    const markup = renderToStaticMarkup(pageElement);
    expect(markup).toContain("Green");
  });

  it("resolves /collections/everyday-milk-chai without 404", async () => {
    const pageElement = await CategoryCollectionPage({
      params: Promise.resolve({ slug: "everyday-milk-chai" }),
    });
    const markup = renderToStaticMarkup(pageElement);
    expect(markup).toContain("Everyday Milk Chai");
  });

  it("gracefully redirects unknown collection slugs to /shop with query instead of crashing to 404", async () => {
    try {
      await CategoryCollectionPage({
        params: Promise.resolve({ slug: "completely-unknown-lot-xyz-never-seen" }),
      });
      // Should not reach here because redirect throws NEXT_REDIRECT
      expect.unreachable();
    } catch (err: any) {
      expect(err.message).toBe("NEXT_REDIRECT");
    }
  });
});

describe("Navigation Presets & Site Navigation", () => {
  it("includes Blog in default site navigation footer_links", () => {
    const nav = getSiteNavigation();
    expect(nav.footer_links.some((l) => l.href === "/blog")).toBe(true);
  });
});
